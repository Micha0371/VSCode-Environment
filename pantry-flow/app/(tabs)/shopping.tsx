import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { ShoppingItem } from '@/components/ShoppingItem';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useTranslation } from '@/lib/i18n';
import { SHOPPING_NAME_MAX, shoppingErrorKey, splitShoppingItems, type ShoppingItem as ShoppingItemData } from '@/lib/shopping-data';
import { colors, spacing, typography } from '@/lib/theme';

type ToggleFailure = { itemId: string; name: string; updatedAt: string; key: string };

export default function ShoppingScreen() {
  const { householdId } = useShoppingItems();
  // Local drafts, locks and feedback belong to one household visit. Remounting
  // also makes pending callbacks from an earlier visit fail the mounted guard,
  // including when the household changes away and then back to the same ID.
  return <HouseholdShoppingScreen key={householdId ?? 'guest'} />;
}

function HouseholdShoppingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { householdId, items, loading, error, retry, addItem, completeItem, reopenItem } = useShoppingItems();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // A toggle failure belongs to one item: it names the item and is hidden once that item
  // is removed or changed by a later successful write (updated_at is server-set). A
  // missing-item failure stays until the next action, because the row is already gone.
  const [actionError, setActionError] = useState<ToggleFailure | null>(null);
  // Screen-local lock (not useItemMutation): the tab stays mounted, so a success must
  // clear the field regardless of focus. The ref blocks a second synchronous submit.
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const submit = useCallback(async () => {
    if (!householdId || lock.current) return;
    lock.current = true;
    setBusy(true);
    setAddError(null);
    const submitted = name;
    try {
      await addItem({ name: submitted });
      if (mounted.current) setActionError(null);
      // Clear only if the user has not started typing the next item.
      if (mounted.current) setName(current => (current === submitted ? '' : current));
    } catch (e) {
      if (mounted.current) setAddError(t(shoppingErrorKey(e)));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [addItem, householdId, name, t]);

  // Per-item lock: the ref stops a second synchronous tap before the provider is called;
  // the mirrored state drives each row's pending prop.
  const toggling = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback(async (item: ShoppingItemData) => {
    if (toggling.current.has(item.id)) return;
    toggling.current.add(item.id);
    setActionError(null);
    setPendingIds(new Set(toggling.current));
    try {
      await (item.is_checked ? reopenItem(item.id) : completeItem(item.id));
    } catch (e) {
      if (mounted.current) {
        setActionError({ itemId: item.id, name: item.name, updatedAt: item.updated_at, key: shoppingErrorKey(e) });
      }
    } finally {
      toggling.current.delete(item.id);
      if (mounted.current) setPendingIds(new Set(toggling.current));
    }
  }, [completeItem, reopenItem]);

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
  const failedItem = actionError ? items.find(it => it.id === actionError.itemId) : undefined;
  const visibleActionError = actionError && (actionError.key === 'err_shopping_missing'
    || failedItem?.updated_at === actionError.updatedAt) ? actionError : null;
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
          // The tab stays mounted, so an add error must not outlive the text it was about.
          onChangeText={(text) => { setName(text); setAddError(null); }}
          placeholder={t('shopping_add_placeholder')}
          maxLength={SHOPPING_NAME_MAX}
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
      {visibleActionError ? (
        <Text style={styles.actionError} accessibilityRole="alert" testID="shopping-action-error">
          {`${visibleActionError.name}: ${t(visibleActionError.key)}`}
        </Text>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={t('shopping_empty_title')} subtitle={t('shopping_empty_subtitle')} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          extraData={pendingIds}
          renderItem={({ item }) => (
            <ShoppingItem
              item={item}
              onToggle={() => { void toggle(item); }}
              onPress={() => router.push(`/shopping-item/${item.id}`)}
              pending={pendingIds.has(item.id)}
            />
          )}
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
  actionError: {
    ...typography.small,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
});
