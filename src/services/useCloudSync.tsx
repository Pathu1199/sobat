import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { applyCloud, forCloud, merge3, sameCloud, type CloudState } from '../core/sync';
import { useApp } from '../store/AppProvider';
import { CloudError, cloudConfigured, deleteData, getData, putData, type RemoteFile } from './cloud';
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
  /** Sign out. Refuses while changes are unsaved, unless forced; a clean sign-out wipes the device. */
  signOut: (force?: boolean) => Promise<'ok' | 'unsynced'>;
};

/** Whose data this device holds, so another account signing in starts clean. */
const OWNER_KEY = 'sobat.cloud.owner';
const PUSH_DELAY_MS = 3000;
const PULL_EVERY_MS = 5 * 60 * 1000;
const MAX_ROUNDS = 3;

const Ctx = createContext<CloudSync | null>(null);

function parseRemote(file: RemoteFile): CloudState | null {
  if (!file.state) return null;
  try {
    return JSON.parse(file.state) as CloudState;
  } catch {
    return null;
  }
}

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { user, ready } = useAuth();
  const { state, ready: stateReady, importState, resetAll } = app;

  const configured = cloudConfigured();
  const [status, setStatus] = useState<SyncStatus>(configured ? 'off' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // The file as this device last saw it, and which version that was. Read
  // only inside callbacks and effects, never for rendering: the status
  // carries what the screen needs.
  const base = useRef<CloudState | null>(null);
  const baseModifiedTime = useRef<string | null>(null);
  const boundUid = useRef<string | null>(null);
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

  /**
   * One round: push if there are changes, pull if asked, merge whatever the
   * relay says is newer, and remember the result as the new base. Throws on
   * anything the relay could not do.
   */
  const round = useCallback(
    async (pull: boolean, token: string) => {
      const extra = { name: stateRef.current.profile.name || user?.name || undefined, platform: Platform.OS };
      for (let attempt = 0; attempt < MAX_ROUNDS; attempt++) {
        const local = forCloud(stateRef.current);
        const changed = base.current === null || !sameCloud(local, base.current);
        let remote: RemoteFile;

        if (changed && !pull && base.current !== null) {
          // The common case: push on top of the version we know.
          const res = await putData(token, JSON.stringify(local), baseModifiedTime.current, extra);
          if (res.ok) {
            base.current = local;
            baseModifiedTime.current = res.modifiedTime;
            return;
          }
          remote = res.stale;
        } else {
          remote = await getData(token);
        }

        if (!changed && remote.modifiedTime === baseModifiedTime.current) return;

        const theirs = parseRemote(remote);
        const merged = theirs ? merge3(base.current, local, theirs) : local;
        if (!sameCloud(merged, local)) {
          importState(JSON.stringify(applyCloud(stateRef.current, merged)));
        }
        if (theirs && sameCloud(merged, theirs)) {
          // The account already has exactly this; nothing to write.
          base.current = merged;
          baseModifiedTime.current = remote.modifiedTime;
          return;
        }
        const res = await putData(token, JSON.stringify(merged), remote.modifiedTime, extra);
        if (res.ok) {
          base.current = merged;
          baseModifiedTime.current = res.modifiedTime;
          return;
        }
        // Someone wrote again in the meantime; go round with their newest.
        pull = true;
      }
      throw new CloudError(409, 'kept_changing');
    },
    [importState, user?.name],
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
          setStatus('syncing');
          try {
            const token = await authApi.idToken();
            if (!token) throw new CloudError(401, 'not_signed_in');
            await round(pull, token);
            await AsyncStorage.setItem(OWNER_KEY, boundUid.current).catch(() => {});
            setStatus('synced');
            setError(null);
            setLastSyncAt(new Date().toISOString());
          } catch (e) {
            fail(e);
            break;
          }
          pull = false;
        } while (again.current);
      } finally {
        inFlight.current = false;
      }
    },
    [configured, round, fail],
  );

  // Bind to the account: a different account than the device last held starts clean, then the first sync pulls.
  useEffect(() => {
    if (!configured || !ready || !stateReady) return;
    if (!user) {
      boundUid.current = null;
      base.current = null;
      baseModifiedTime.current = null;
      // Deliberate: the status mirrors the session, which only changes here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('off');
      return;
    }
    if (boundUid.current === user.uid) return;
    let cancelled = false;
    (async () => {
      const owner = await AsyncStorage.getItem(OWNER_KEY).catch(() => null);
      if (cancelled) return;
      if (owner && owner !== user.uid) {
        // Someone else's unsynced leftovers must not be merged into this account.
        resetAll();
        await AsyncStorage.removeItem(OWNER_KEY).catch(() => {});
      }
      boundUid.current = user.uid;
      base.current = null;
      baseModifiedTime.current = null;
      await sync({ pull: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, ready, stateReady, user, sync, resetAll]);

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
    try {
      const token = await authApi.idToken();
      if (token && configured) await deleteData(token);
      base.current = null;
      baseModifiedTime.current = null;
      await AsyncStorage.removeItem(OWNER_KEY).catch(() => {});
      resetAll();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [configured, resetAll, fail]);

  const signOut = useCallback(
    async (force = false): Promise<'ok' | 'unsynced'> => {
      const clean = !configured || upToDate;
      if (!clean && !force) return 'unsynced';
      boundUid.current = null;
      if (clean) {
        // Everything is in the account: hand the device back empty.
        await AsyncStorage.removeItem(OWNER_KEY).catch(() => {});
        resetAll();
      }
      // Unsaved changes stay on the device, tagged with their owner, so the
      // same account gets them back and any other account starts clean.
      await authApi.signOut().catch(() => {});
      return 'ok';
    },
    [configured, upToDate, resetAll],
  );

  const value: CloudSync = { status, error, lastSyncAt, upToDate, syncNow, eraseEverywhere, signOut };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloudSync(): CloudSync {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloudSync must be used inside CloudSyncProvider');
  return c;
}
