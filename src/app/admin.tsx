import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { fill, makeT } from '../i18n';
import { adminApi, cloudConfigured, type CloudUser } from '../services/cloud';
import { authApi, useAuth } from '../services/useAuth';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

function when(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function size(bytes?: number): string {
  if (!bytes) return '—';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
  } else {
    Alert.alert('', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: onYes }]);
  }
}

/**
 * Every account, for the admin only: who signed in, when, from where, how
 * much they have stored, and the switches to block or wipe. The list comes
 * from the relay's directory; the files themselves sit in the admin's own
 * Google Drive, in the Sobat folder.
 */
export default function Admin() {
  const { state } = useApp();
  const { user, isAdmin, ready } = useAuth();
  const t = makeT(state.profile.lang);
  const [users, setUsers] = useState<CloudUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withToken = useCallback(async (fn: (token: string) => Promise<void>) => {
    const token = await authApi.idToken();
    if (!token) return;
    try {
      await fn(token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const load = useCallback(() => withToken(async (token) => setUsers(await adminApi.list(token))), [withToken]);

  useEffect(() => {
    // The list is fetched, not derived; the state lands when the network answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdmin && cloudConfigured()) void load();
  }, [isAdmin, load]);

  if (ready && !isAdmin) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{t('admin_title')}</Text>
        <Small color={C.textDim}>{t('admin_sub')}</Small>
      </View>
      {!cloudConfigured() ? <Small color={C.amber}>{t('sync_unconfigured')}</Small> : null}
      {error ? <Small color={C.amber}>{error}</Small> : null}
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
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>
                  {u.name || '—'}
                  {me ? <Text style={{ color: C.textFaint, fontWeight: '500' }}>{`  (${t('admin_you')})`}</Text> : null}
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
              <Stat label={t('admin_size')} value={size(u.bytes)} />
            </Row>
            {!me ? (
              <Row style={{ gap: 8 }}>
                <Btn
                  small
                  tone="soft"
                  label={u.disabled ? t('admin_unblock') : t('admin_block')}
                  onPress={() => withToken((token) => adminApi.setBlocked(token, u.uid, !u.disabled)).then(load)}
                  icon={<Ionicons name={u.disabled ? 'lock-open-outline' : 'lock-closed-outline'} size={14} color={C.text} />}
                  style={{ flex: 1 }}
                />
                <Btn
                  small
                  tone="danger"
                  label={t('admin_delete')}
                  onPress={() => confirm(fill(t('admin_delete_confirm'), { email: u.email }), () => withToken((token) => adminApi.remove(token, u.uid)).then(load))}
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
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
