import React, { useState } from 'react';
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

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch {
      setError(t('err_login_failed'));
    } finally {
      setSubmitting(false);
    }
  };

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
          <Text style={styles.title}>{t('auth_login_title')}</Text>

          <Input
            label={t('auth_email')}
            placeholder={t('auth_email_placeholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            testID="login-email"
          />
          <Input
            label={t('auth_password')}
            placeholder={t('auth_password_placeholder')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="login-password"
            error={error}
          />

          <Button
            label={t('auth_login_button')}
            onPress={onSubmit}
            loading={submitting}
            disabled={!email || !password}
            style={{ marginTop: spacing.md }}
            testID="login-submit"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth_no_account')} </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="go-register">
                <Text style={styles.switchLink}>{t('auth_go_to_register')}</Text>
              </Pressable>
            </Link>
          </View>
          <Link href="/(auth)/confirm-email" asChild>
            <Pressable testID="login-resend-confirmation">
              <Text style={[styles.switchLink, styles.resendLink]}>{t('auth_resend_confirmation')}</Text>
            </Pressable>
          </Link>
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
  resendLink: { textAlign: 'center' },
});
