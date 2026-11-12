import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ShoppingItem } from '@/components/ShoppingItem';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useTranslation } from '@/lib/i18n';
import { shoppingErrorKey, splitShoppingItems } from '@/lib/shopping-data';
import { colors, spacing, typography } from '@/lib/theme';

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const { householdId, items, loading, error, retry, addItem } = useShoppingItems();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Screen-local lock (not useItemMutation): the tab stays mounted, so a success must
  // clear the field regardless of focus. The ref blocks a second synchronous submit.
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const submit = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setAddError(null);
    const submitted = name;
    try {
      await addItem({ name: submitted });
      // Clear only if the user has not started typing the next item.
      if (mounted.current) setName(current => (current === submitted ? '' : current));
    } catch (e) {
      if (mounted.current) setAddError(t(shoppingErrorKey(e)));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [addItem, name, t]);

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

  const addBar = (
    <View style={styles.addBar}>
      <View style={styles.addField}>
        <Input
          testID="shopping-add-input"
          value={name}
          onChangeText={setName}
          placeholder={t('shopping_add_placeholder')}
          error={addError}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => { void submit(); }}
        />
      </View>
      <Button
        label={t('shopping_add_button')}
        onPress={() => { void submit(); }}
        loading={busy}
        disabled={!householdId}
        testID="shopping-add-submit"
        style={styles.addButton}
      />
    </View>
  );

  return (
    <View style={styles.container} testID="shopping-screen">
      {addBar}
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
          keyboardShouldPersistTaps="handled"
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
  addBar: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  addField: { flex: 1 },
  addButton: { minWidth: 72 },
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
