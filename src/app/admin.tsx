import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { fill, makeT } from '../i18n';
import { db } from '../services/firebase';
import { useAuth } from '../services/useAuth';
import { adminApi, type CloudUser } from '../services/useCloudSync';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

function when(ts?: { seconds: number } | string): string {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts.seconds * 1000);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
  } else {
    Alert.alert('', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: onYes }]);
  }
}

/** Every account, for the admin only: who signed in, when, from where, and the switches to block or wipe. */
export default function Admin() {
  const { state } = useApp();
  const { user, isAdmin, ready } = useAuth();
  const t = makeT(state.profile.lang);
  const [users, setUsers] = useState<CloudUser[] | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    const snap = await getDocs(query(collection(db, 'users'), orderBy('lastSeen', 'desc'))).catch(() => null);
    setUsers(snap ? snap.docs.map((d) => ({ ...(d.data() as CloudUser), uid: d.id })) : []);
  }, []);

  useEffect(() => {
    // The list is fetched, not derived; the state lands when the network answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (ready && !isAdmin) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '600' }}>{t('admin_title')}</Text>
        <Small color={C.textDim}>{t('admin_sub')}</Small>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{fill(t('admin_users'), { n: users?.length ?? 0 })}</Micro>
        <Btn small tone="ghost" label={t('admin_refresh')} onPress={load} icon={<Ionicons name="refresh" size={14} color={C.text} />} />
      </Row>
      {users && users.length === 0 ? <Small color={C.textFaint}>{t('admin_empty')}</Small> : null}
      {(users ?? []).map((u) => {
        const me = u.uid === user?.uid;
        return (
          <Card key={u.uid} rail={u.disabled ? C.red : me ? C.accent : undefined}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                  {u.name || '—'}
                  {me ? <Text style={{ color: C.textFaint, fontWeight: '400' }}>{`  (${t('admin_you')})`}</Text> : null}
                </Text>
                <Small color={C.textDim}>{u.email}</Small>
              </View>
              <Row style={{ gap: 6 }}>
                {u.disabled ? <Pill label={t('admin_blocked')} color={C.red} textColor={C.white} /> : null}
                <Pill label={u.platform || '—'} />
              </Row>
            </Row>
            <Row style={{ gap: 16, flexWrap: 'wrap' }}>
              <Stat label={t('admin_last_seen')} value={when(u.lastSeen)} />
              <Stat label={t('admin_joined')} value={when(u.createdAt)} />
              <Stat label={t('admin_logins')} value={String(u.logins?.length ?? 0)} />
              <Stat label={t('admin_meals')} value={String(u.meals ?? 0)} />
              {u.weightKg ? <Stat label={t('add_weight')} value={`${u.weightKg} ${t('unit_kg')}`} /> : null}
            </Row>
            {u.logins?.length ? (
              <View style={{ gap: 2 }}>
                {u.logins.slice(0, 3).map((l, i) => (
                  <Micro key={i} color={C.textFaint}>{`${when(l.at)} · ${l.platform}`}</Micro>
                ))}
              </View>
            ) : null}
            {!me ? (
              <Row style={{ gap: 8 }}>
                <Btn
                  small
                  tone="soft"
                  label={u.disabled ? t('admin_unblock') : t('admin_block')}
                  onPress={() => adminApi.setBlocked(u.uid, !u.disabled).then(load)}
                  icon={<Ionicons name={u.disabled ? 'lock-open-outline' : 'lock-closed-outline'} size={14} color={C.text} />}
                  style={{ flex: 1 }}
                />
                <Btn
                  small
                  tone="danger"
                  label={t('admin_delete')}
                  onPress={() => confirm(fill(t('admin_delete_confirm'), { email: u.email }), () => adminApi.deleteData(u.uid).then(load))}
                  icon={<Ionicons name="trash-outline" size={14} color={C.red} />}
                  style={{ flex: 1 }}
                />
              </Row>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
