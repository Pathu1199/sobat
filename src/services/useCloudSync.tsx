import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { bindStart, encodeSavedBase, forCloud, inAccount, landMerge, readSavedBase, RoundStop, sameCloud, signOutPlan, syncRound, type CloudState } from '../core/sync';
import { CLOUD_BASE_KEY, OWNER_KEY, useApp } from '../store/AppProvider';
import { EMPTY_STATE, STATE_VERSION } from '../store/defaults';
import { CloudError, cloudConfigured, deleteData, getData, putData } from './cloud';
import { authApi, useAuth } from './useAuth';

/**
 * The account's copy of the data: one file, kept by the relay in the app
 * maker's Google Drive, merged with this device record by record.
 *
 * On sign-in the device pulls the file and merges; after that every change
 * is pushed a few seconds later, and the file is pulled again whenever the
 * app comes back to the front. A push names the version it was built on, so
 * if another device wrote in between the relay refuses, hands back the
 * current file, and the device merges and tries once more. All the deciding
 * is in core/sync.ts; this is the plumbing and the timing.
 *
 * A failed push is shown as failed. Nothing on the device is ever thrown
 * away until it is known to have reached the account.
 *
 * The base every merge is worked out against is saved beside the state, in
 * the same storage call, so a restart still knows which side changed what.
 * A file written by a newer build is never merged or written over: this one
 * would drop what it does not understand. The status says to update.
 */
export type SyncStatus = 'unconfigured' | 'off' | 'syncing' | 'synced' | 'pending' | 'error' | 'blocked';

export type CloudSync = {
  status: SyncStatus;
  /** Why the last attempt failed, for the Settings line. */
  error: string | null;
  lastSyncAt: string | null;
  /** True when everything on this device has reached the account. */
  upToDate: boolean;
  syncNow: () => Promise<void>;
  /** Delete the account's file, then wipe this device. */
  eraseEverywhere: () => Promise<boolean>;
  /** Sign out. Refuses while anything is not in the account (always, with sync not set up), unless forced; only a sign-out with everything in the account wipes the device. */
  signOut: (force?: boolean) => Promise<'ok' | 'unsynced'>;
};

const PUSH_DELAY_MS = 3000;
const PULL_EVERY_MS = 5 * 60 * 1000;

/** How a round that stopped is shown: the relay's own errors arrive as CloudErrors already. */
const STOP_STATUS: Record<RoundStop['reason'], number> = { abandoned: 0, update_app: 426, unreadable: 422, kept_changing: 409 };

const Ctx = createContext<CloudSync | null>(null);

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { user, ready } = useAuth();
  const { state, ready: stateReady, storageError, mergeState, readNow, resetAll, saveCloudBase, switchAccount } = app;

  const configured = cloudConfigured();
  const [status, setStatus] = useState<SyncStatus>(configured ? 'off' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // The file as this device last saw it, and which version that was. Read
  // only inside callbacks and effects, never for rendering: the status
  // carries what the screen needs. Loaded from disk at bind, saved by settle.
  const base = useRef<CloudState | null>(null);
  const baseModifiedTime = useRef<string | null>(null);
  const boundUid = useRef<string | null>(null);
  // Moves on at every bind and sign-out, so a request that went out for one
  // session never lands in the next.
  const epoch = useRef(0);
  // Binds run one after another: two at once could each put the device's data aside.
  const binding = useRef<Promise<void>>(Promise.resolve());
  // Set from a sign-out until the session is gone, so the account leaving is not bound again meanwhile.
  const signingOut = useRef(false);
  const inFlight = useRef(false);
  const again = useRef(false);
  const stateRef = useRef(state);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  });

  const fail = useCallback((e: unknown) => {
    if (e instanceof CloudError && e.code === 'blocked') {
      setStatus('blocked');
      setError(null);
      authApi.signOut().catch(() => {});
      return;
    }
    setStatus('error');
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  /** The account now holds `file` at `modifiedTime`: remember it, here and on disk beside the state. */
  const settle = useCallback(
    (uid: string, file: CloudState, modifiedTime: string | null) => {
      base.current = file;
      baseModifiedTime.current = modifiedTime;
      saveCloudBase(encodeSavedBase({ uid, base: file, modifiedTime }));
    },
    [saveCloudBase],
  );

  /**
   * One round, worked out in core/sync.ts: push if there are changes, pull if
   * asked, merge whatever the relay says is newer, and remember the result as
   * the new base. Throws on anything the relay could not do, and drops the
   * answer if the account changed while the request was out.
   */
  const round = useCallback(
    async (pull: boolean, token: string, uid: string, live: () => boolean) => {
      const extra = { name: stateRef.current.profile.name || user?.name || undefined, platform: Platform.OS };
      const out = await syncRound({
        pull,
        base: base.current,
        modifiedTime: baseModifiedTime.current,
        supported: STATE_VERSION,
        io: {
          readNow,
          // Onto the state as it is when this lands, not as it was when the request went out.
          land: (local, merged) => mergeState((now) => landMerge(now, local, merged)),
          get: () => getData(token),
          put: (file, at) => putData(token, JSON.stringify(file), at, extra),
          live,
        },
      });
      if (!live()) throw new RoundStop('abandoned');
      if (out) settle(uid, out.base, out.modifiedTime);
    },
    [readNow, mergeState, settle, user?.name],
  );

  /** Run rounds until nothing is waiting. A call that lands mid-round queues one more. */
  const sync = useCallback(
    async (opts: { pull: boolean }) => {
      if (!configured || !boundUid.current) return;
      if (inFlight.current) {
        again.current = true;
        return;
      }
      inFlight.current = true;
      let pull = opts.pull;
      try {
        do {
          again.current = false;
          // Read each time round: the account may have changed while the last round was out.
          const uid = boundUid.current;
          if (!uid) break;
          const at = epoch.current;
          const live = () => epoch.current === at;
          setStatus('syncing');
          try {
            const token = await authApi.idToken();
            if (!live()) throw new RoundStop('abandoned');
            if (!token) throw new CloudError(401, 'not_signed_in');
            await round(pull, token, uid, live);
            // An edit made while the round was out is not in the account yet; its push is already queued.
            const now = await readNow();
            if (!live()) throw new RoundStop('abandoned');
            setStatus(inAccount(base.current, now) ? 'synced' : 'pending');
            setError(null);
            setLastSyncAt(new Date().toISOString());
          } catch (e) {
            // Whatever the new session asked for meanwhile is waiting in `again`, and starts with a pull.
            if (e instanceof RoundStop && e.reason === 'abandoned') {
              pull = true;
              continue;
            }
            fail(e instanceof RoundStop ? new CloudError(STOP_STATUS[e.reason], e.reason) : e);
            break;
          }
          pull = false;
        } while (again.current);
      } finally {
        inFlight.current = false;
      }
    },
    [configured, round, readNow, fail],
  );

  // Bind to the account. Another account's data on the device is put aside
  // for them and this account's comes back if it was put aside here before;
  // the device is tagged as this account's; then the first sync pulls. With
  // sync not set up there is no first sync, but the tag still keeps one
  // account's data from showing up under another.
  useEffect(() => {
    if (!ready || !stateReady) return;
    if (!user) {
      signingOut.current = false;
      epoch.current += 1;
      boundUid.current = null;
      base.current = null;
      baseModifiedTime.current = null;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      // Deliberate: the status mirrors the session, which only changes here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (configured) setStatus('off');
      return;
    }
    if (boundUid.current === user.uid || signingOut.current) return;
    const uid = user.uid;
    let cancelled = false;
    binding.current = binding.current
      .then(async () => {
        if (cancelled || boundUid.current === uid || signingOut.current) return;
        const [owner, saved] = await Promise.all([AsyncStorage.getItem(OWNER_KEY).catch(() => null), AsyncStorage.getItem(CLOUD_BASE_KEY).catch(() => null)]);
        if (cancelled) return;
        // The base is loaded before the first merge: without it, deletions and edits made elsewhere since the last run would be undone.
        const start = bindStart({ uid, owner, saved: readSavedBase(saved), loaded: storageError !== 'load' });
        // Nothing still out for the last session may land from here on.
        epoch.current += 1;
        boundUid.current = null;
        let first = { base: start.base, modifiedTime: start.modifiedTime };
        if (start.aside) {
          try {
            const back = readSavedBase(await switchAccount(start.aside, uid));
            if (back?.uid === uid) first = { base: back.base, modifiedTime: back.modifiedTime };
          } catch (e) {
            // Could not put it aside: nothing is lost, and nothing syncs into this account.
            if (configured) fail(e);
            return;
          }
        } else if (start.tag) {
          await AsyncStorage.setItem(OWNER_KEY, uid).catch(() => {});
        }
        if (cancelled) return;
        boundUid.current = uid;
        base.current = first.base;
        baseModifiedTime.current = first.modifiedTime;
        void sync({ pull: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [configured, ready, stateReady, storageError, user, sync, switchAccount, fail]);

  // Push a moment after changes settle. Nothing is pushed before the first
  // pull has set a base, so a fresh sign-in never overwrites the account.
  useEffect(() => {
    if (!configured || !boundUid.current || base.current === null) return;
    if (sameCloud(forCloud(state), base.current)) return;
    setStatus((s) => (s === 'syncing' || s === 'blocked' ? s : 'pending'));
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void sync({ pull: false }), PUSH_DELAY_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, configured, sync]);

  // Coming back to the front, and every few minutes while in front: see what other devices wrote.
  useEffect(() => {
    if (!configured) return;
    const pull = () => {
      if (boundUid.current && base.current !== null) void sync({ pull: true });
    };
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') pull();
    });
    const id = setInterval(() => {
      if (RNAppState.currentState === 'active') pull();
    }, PULL_EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [configured, sync]);

  // The status is the truth about the device: 'synced' is only set after a
  // round confirmed the account holds everything, and any change since
  // flips it to 'pending' at once.
  const upToDate = status === 'synced';

  const syncNow = useCallback(() => sync({ pull: true }), [sync]);

  const eraseEverywhere = useCallback(async () => {
    // Nothing still out may land on the emptied device or write the file back: dropped now, and again once it is gone.
    epoch.current += 1;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    try {
      const token = await authApi.idToken();
      const erased = configured && token !== null;
      if (erased) await deleteData(token);
      epoch.current += 1;
      resetAll();
      if (erased && boundUid.current) {
        // The account holds nothing now, and neither does the device: the next change is written as a new file.
        base.current = forCloud(EMPTY_STATE);
        baseModifiedTime.current = null;
        setStatus('synced');
        setError(null);
      } else {
        base.current = null;
        baseModifiedTime.current = null;
      }
      // The device stays this account's: the owner tag is kept.
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [configured, resetAll, fail]);

  const signOut = useCallback(
    async (force = false): Promise<'ok' | 'unsynced'> => {
      // Not the status alone: it can be a moment behind an edit.
      const allIn = status === 'synced' && inAccount(base.current, await readNow());
      const plan = signOutPlan({ configured, upToDate: allIn, force, loaded: storageError !== 'load' });
      if (plan === 'ask') return 'unsynced';
      const uid = user?.uid ?? null;
      signingOut.current = true;
      epoch.current += 1;
      boundUid.current = null;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      if (plan === 'wipe') {
        // Everything is in the account: hand the device back empty.
        await AsyncStorage.removeItem(OWNER_KEY).catch(() => {});
        resetAll();
      } else if (uid) {
        // Whatever is not in the account stays on the device, tagged with its
        // owner, so the same account gets it back and any other account starts clean.
        await AsyncStorage.setItem(OWNER_KEY, uid).catch(() => {});
      }
      await authApi.signOut().catch(() => {
        // Still signed in: binding may resume.
        signingOut.current = false;
      });
      return 'ok';
    },
    [configured, status, storageError, readNow, user?.uid, resetAll],
  );

  const value: CloudSync = { status, error, lastSyncAt, upToDate, syncNow, eraseEverywhere, signOut };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloudSync(): CloudSync {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloudSync must be used inside CloudSyncProvider');
  return c;
}
