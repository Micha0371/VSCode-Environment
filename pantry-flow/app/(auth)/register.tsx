import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const router = useRouter();

  const [confirmation, setConfirmation] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  const onSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await signUp(name.trim(), email.trim(), password);
      if (outcome === 'signed_in') router.replace('/(tabs)');
      else setConfirmation(true);
    } catch {
      setError(t('err_register_failed'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (confirmation) return <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth_check_email_title')}</Text>
      <Text style={styles.switchText}>{t('auth_check_email_message')}</Text>
      <Button label={t('auth_go_to_login')} onPress={() => router.replace('/(auth)/login')} />
      <Button testID="register-resend-confirmation" label={t('auth_resend_confirmation')} onPress={() => router.replace('/(auth)/confirm-email')} />
    </View>
  </SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t('auth_register_title')}</Text>

          <Input
            label={t('auth_name')}
            placeholder={t('auth_name_placeholder')}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoCapitalize="words"
            testID="register-name"
          />
          <Input
            label={t('auth_email')}
            placeholder={t('auth_email_placeholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            testID="register-email"
          />
          <Input
            label={t('auth_password')}
            placeholder={t('auth_password_placeholder')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="register-password"
            error={error}
          />

          <Button
            label={t('auth_register_button')}
            onPress={onSubmit}
            loading={submitting}
            disabled={!name.trim() || !email.trim() || password.length < 6}
            style={{ marginTop: spacing.md }}
            testID="register-submit"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth_have_account')} </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="go-login">
                <Text style={styles.switchLink}>{t('auth_go_to_login')}</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: { ...typography.body, color: colors.textMuted },
  switchLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
