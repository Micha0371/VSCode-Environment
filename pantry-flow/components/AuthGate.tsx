import React, { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { Button } from './Button';

// Used by every route, including direct links to root-level item modals.
export function AuthGate({ children, requireSession = false }: { children: ReactNode; requireSession?: boolean }) {
  const { loading, error, session, retrySession } = useAuth();
  const { t } = useTranslation();
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (error) return <View style={styles.center}>
    <Text accessibilityRole="alert">{t(error)}</Text>
    <Button label={t('common_retry')} onPress={() => { void retrySession(); }} />
  </View>;
  if (requireSession && !session) return <Redirect href="/(auth)/login" />;
  return <>{children}</>;
}
const styles = StyleSheet.create({ center: {
  flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  gap: spacing.md, backgroundColor: colors.bg,
} });
