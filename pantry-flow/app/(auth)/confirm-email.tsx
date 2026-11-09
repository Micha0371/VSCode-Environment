import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { resendConfirmation } from '@/lib/email-confirmation';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

export default function ConfirmEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => { locked.current = false; setCooldown(false); }, 60000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const resend = async () => {
    if (locked.current || cooldown) return;
    locked.current = true;
    let delivered = false;
    setSubmitting(true); setError(null); setSent(false);
    try {
      await resendConfirmation(email);
      delivered = true;
      if (mounted.current) { setSent(true); setCooldown(true); }
    } catch (cause) {
      if (mounted.current) setError(t(typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 429 ? 'err_confirmation_rate_limit' : 'err_confirmation_resend'));
    } finally {
      if (!delivered) locked.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('auth_check_email_title')}</Text>
      <Text style={styles.message}>{t('auth_confirmation_recovery')}</Text>
      <Input label={t('auth_email')} value={email} onChangeText={setEmail} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" maxLength={254} testID="confirmation-email" error={error} />
      {sent && <Text accessibilityLiveRegion="polite" testID="confirmation-sent" style={styles.message}>{t('auth_confirmation_sent')}</Text>}
      <Button testID="confirmation-resend" label={t(cooldown ? 'auth_confirmation_wait' : 'auth_resend_confirmation')}
        loading={submitting} disabled={!email.trim() || cooldown} onPress={resend} />
      <Button testID="confirmation-back-login" label={t('auth_go_to_login')} onPress={() => router.replace('/(auth)/login')} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
});
