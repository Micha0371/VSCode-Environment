import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { OptionChips } from '@/components/OptionChips';
import { AuthGate } from '@/components/AuthGate';
import { useItemMutation } from '@/hooks/useItemMutation';
import { ITEM_NAME_MAX, itemSaveErrorKey } from '@/lib/pantry-data';
import { usePantryItems } from '@/hooks/usePantryItems';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { shoppingErrorKey } from '@/lib/shopping-data';
import { offersShoppingAdd } from '@/lib/pantry-shopping';
import { useTranslation } from '@/lib/i18n';
import { CATEGORIES, LOCATIONS, STATUSES } from '@/lib/constants';
import { colors, radii, spacing, typography, StatusKey } from '@/lib/theme';

// Resolves true on the affirmative button, false on the other button or dismissal.
function ask(title: string, message: string, addLabel: string, skipLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: skipLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: addLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function notice(title: string, message: string, okLabel: string): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: okLabel, onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() });
  });
}

export default function EditItemModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AuthGate requireSession><EditItemModalContent key={id} /></AuthGate>;
}

function EditItemModalContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { loading, error: loadError, retry, updateItem, deleteItem, getItem } = usePantryItems();
  const { addItem: addShoppingItem } = useShoppingItems();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const item = id ? getItem(id) : null;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [location, setLocation] = useState<string>('pantry');
  const [status, setStatus] = useState<StatusKey>('in_stock');
  const [hydrated, setHydrated] = useState(false);
  const { busy, run } = useItemMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item && !hydrated) {
      setName(item.name);
      setCategory(item.category);
      setLocation(item.location);
      setStatus(item.status);
      setHydrated(true);
    }
  }, [item, hydrated]);

  if (loading && !item) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t(loadError ?? 'err_item_missing')}</Text>
        <Button label={t('common_retry')} onPress={() => { void retry(); }} />
        <Button
          label={t('common_back')}
          onPress={() => router.back()}
          variant="secondary"
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const onSave = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('err_required_name'));
      return;
    }
    if (Array.from(trimmed).length > ITEM_NAME_MAX) {
      setError(t('err_item_name_length')); return;
    }
    setError(null);
    const previous = item.status;
    await run(
      async () => {
        const saved = await updateItem(item.id, { name: trimmed, category, location, status });
        if (!mounted.current || !offersShoppingAdd(previous, saved.status)) return;
        if (!(await ask(t('shopping_prompt_title'), saved.name, t('shopping_prompt_add'), t('shopping_prompt_skip')))) return;
        try {
          await addShoppingItem({ name: saved.name, pantryItemId: saved.id });
        } catch (shoppingError) {
          await notice(t('shopping_prompt_failed_title'), t(shoppingErrorKey(shoppingError)), t('common_ok'));
        }
      },
      () => router.back(),
      (failure) => setError(t(itemSaveErrorKey(failure))),
    );
  };

  const onDelete = () => {
    if (busy) return;
    Alert.alert(
      t('item_delete_confirm_title'),
      t('item_delete_confirm_message'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete'),
          style: 'destructive',
          onPress: () => { void run(
            () => deleteItem(item.id),
            () => router.back(),
            () => setError(t('err_delete_item')),
          ); },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('item_edit_title')}</Text>

        <Input
          label={t('item_name')}
          placeholder={t('item_name_placeholder')}
          maxLength={ITEM_NAME_MAX}
          editable={!busy}
          value={name}
          onChangeText={setName}
          testID="edit-item-name"
          error={error}
        />

        <Text style={styles.sectionLabel}>{t('item_status')}</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const selected = s === status;
            const color = colors.status[s];
            const bg = selected ? color : colors.surface;
            const fg = selected ? colors.primaryOn : color;
            return (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                testID={`edit-item-status-${s}`}
                style={[
                  styles.statusPill,
                  { backgroundColor: bg, borderColor: color },
                ]}
              >
                <Text style={[styles.statusText, { color: fg }]}>
                  {t(`status_${s}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t('item_category')}</Text>
        <OptionChips
          options={[...CATEGORIES]}
          value={category}
          onChange={setCategory}
          labelFor={(k) => t(`cat_${k}`)}
          testIDPrefix="edit-item-category"
        />

        <View style={{ height: spacing.md }} />

        <Text style={styles.sectionLabel}>{t('item_location')}</Text>
        <OptionChips
          options={[...LOCATIONS]}
          value={location}
          onChange={setLocation}
          labelFor={(k) => t(`loc_${k}`)}
          testIDPrefix="edit-item-location"
        />

        <View style={styles.actions}>
          <Button
            label={t('common_cancel')}
            onPress={() => router.back()}
            variant="secondary"
            disabled={busy}
            style={{ flex: 1 }}
            testID="edit-item-cancel"
          />
          <View style={{ width: spacing.md }} />
          <Button
            label={t('item_save_button')}
            onPress={onSave}
            loading={busy}
            style={{ flex: 1 }}
            testID="edit-item-save"
          />
        </View>

        <Button
          label={t('item_delete')}
          onPress={onDelete}
          variant="danger"
          disabled={busy}
          style={{ marginTop: spacing.xl }}
          testID="edit-item-delete"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusPill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusText: { ...typography.label, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
