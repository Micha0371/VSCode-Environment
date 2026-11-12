import React from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ShoppingItem } from '@/components/ShoppingItem';
import { Button } from '@/components/Button';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useTranslation } from '@/lib/i18n';
import { splitShoppingItems } from '@/lib/shopping-data';
import { colors, spacing, typography } from '@/lib/theme';

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const { items, loading, error, retry } = useShoppingItems();

  const showLoading = loading && items.length === 0;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">{t(error)}</Text>
        <Button label={t('common_retry')} onPress={() => { void retry(); }} testID="shopping-retry" />
      </View>
    );
  }

  if (showLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { open, completed } = splitShoppingItems(items);
  const sections = [
    { key: 'open', title: t('shopping_section_open'), data: open },
    { key: 'completed', title: t('shopping_section_completed'), data: completed },
  ].filter(section => section.data.length > 0);

  return (
    <View style={styles.container} testID="shopping-screen">
      {items.length === 0 ? (
        <EmptyState title={t('shopping_empty_title')} subtitle={t('shopping_empty_subtitle')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <ShoppingItem item={item} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader} testID={`shopping-section-${section.key}`}>
              {section.title}
            </Text>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: {
    ...typography.small,
    color: colors.textMuted,
    backgroundColor: colors.bg,
    paddingVertical: spacing.sm,
    textTransform: 'uppercase',
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
});
