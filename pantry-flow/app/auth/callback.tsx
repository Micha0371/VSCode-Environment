import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth';
import { confirmEmail, confirmationCode } from '@/lib/email-confirmation';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

export default function ConfirmationCallback() {
  const params = useLocalSearchParams();
  const code = confirmationCode(params);
  const { loading, user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [phase, setPhase] = useState<'working' | 'invalid' | 'already'>('working');
  const mounted = useRef(false);
  const attempted = useRef<string | null | undefined>(undefined);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (loading || attempted.current === code) return;
    attempted.current = code;
    const request = ++generation.current;
    if (user) { setPhase('already'); return; }
    if (!code) { setPhase('invalid'); return; }
    setPhase('working');
    void confirmEmail({ code }).then(() => {
      if (mounted.current && request === generation.current) router.replace('/(tabs)');
    }).catch(() => {
      if (mounted.current && request === generation.current) setPhase('invalid');
    });
  }, [code, loading, user, router]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <Text style={styles.title}>{t(phase === 'working' ? 'auth_confirming' : phase === 'already' ? 'auth_already_signed_in' : 'auth_confirmation_invalid')}</Text>
      {phase === 'working' ? <ActivityIndicator testID="confirmation-progress" color={colors.primary} /> : <>
        {phase === 'invalid' && <Text style={styles.message}>{t('auth_confirmation_recovery')}</Text>}
        <Button testID="confirmation-recover" label={t(phase === 'already' ? 'nav_pantry' : 'auth_resend_confirmation')}
          onPress={() => router.replace(phase === 'already' ? '/(tabs)' : '/(auth)/confirm-email')} />
        <Button testID="confirmation-login" label={t('auth_go_to_login')} onPress={() => router.replace('/(auth)/login')} />
      </>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
});
