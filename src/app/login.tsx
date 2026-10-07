import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { makeT } from '../i18n';
import { firebaseEnabled } from '../services/firebase';
import { authApi, authErrorKey, useAuth } from '../services/useAuth';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Micro, Small } from '../ui/components';
import { Logo } from '../ui/Logo';
import { C, F } from '../ui/theme';

/** Sign in or create an account. Everything after this screen belongs to that account. */
export default function Login() {
  const { state } = useApp();
  const { user, ready } = useAuth();
  const router = useRouter();
  const t = makeT(state.profile.lang);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; key: string } | null>(null);

  if (!firebaseEnabled) return <Redirect href="/" />;
  if (ready && user) return <Redirect href="/" />;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      router.replace('/');
    } catch (e) {
      setMsg({ ok: false, key: authErrorKey(e) });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return setMsg({ ok: false, key: 'auth_err_email' });
    try {
      await authApi.reset(email);
      setMsg({ ok: true, key: 'login_reset_sent' });
    } catch (e) {
      setMsg({ ok: false, key: authErrorKey(e) });
    }
  }

  const input = { backgroundColor: C.cardAlt, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: F.body, borderWidth: 1, borderColor: C.border };
  const canGo = email.includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Logo size={56} />
            <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '600', textAlign: 'center' }}>{t('login_title')}</Text>
            <Small color={C.textDim}>{t('login_sub')}</Small>
          </View>

          {mode === 'up' ? (
            <View style={{ gap: 6 }}>
              <Micro>{t('login_name')}</Micro>
              <TextInput value={name} onChangeText={setName} placeholder={t('login_name')} placeholderTextColor={C.textGhost} style={input} autoCapitalize="words" />
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <Micro>{t('login_email')}</Micro>
            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.textGhost} style={input} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          </View>
          <View style={{ gap: 6 }}>
            <Micro>{t('login_password')}</Micro>
            <TextInput value={password} onChangeText={setPassword} placeholder="••••••" placeholderTextColor={C.textGhost} style={input} secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'} textContentType={mode === 'up' ? 'newPassword' : 'password'} onSubmitEditing={() => canGo && run(() => (mode === 'in' ? authApi.signIn(email, password) : authApi.signUp(email, password, name)))} />
          </View>

          {msg ? <Small color={msg.ok ? C.green : C.amber}>{t(msg.key)}</Small> : null}

          <Btn
            label={busy ? '…' : t(mode === 'in' ? 'login_signin' : 'login_signup')}
            onPress={() => run(() => (mode === 'in' ? authApi.signIn(email, password) : authApi.signUp(email, password, name)))}
            disabled={busy || !canGo}
            icon={<Ionicons name={mode === 'in' ? 'log-in-outline' : 'person-add-outline'} size={16} color={C.white} />}
          />
          {mode === 'in' ? (
            <Pressable onPress={forgot} style={{ alignSelf: 'center' }}>
              <Micro color={C.accent}>{t('login_forgot')}</Micro>
            </Pressable>
          ) : null}

          {authApi.googleAvailable ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Divider />
                </View>
                <Micro>{t('login_or')}</Micro>
                <View style={{ flex: 1 }}>
                  <Divider />
                </View>
              </View>
              <Btn tone="soft" label={t('login_google')} onPress={() => run(() => authApi.google())} disabled={busy} icon={<Ionicons name="logo-google" size={16} color={C.text} />} />
            </>
          ) : null}

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Small color={C.accent}>{t(mode === 'in' ? 'login_switch_up' : 'login_switch_in')}</Small>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
