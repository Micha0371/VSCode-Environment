import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { OptionChips } from '@/components/OptionChips';
import { AuthGate } from '@/components/AuthGate';
import { useItemMutation } from '@/hooks/useItemMutation';
import { ITEM_NAME_MAX, itemSaveErrorKey } from '@/lib/pantry-data';
import { usePantryItems } from '@/hooks/usePantryItems';
import { useTranslation } from '@/lib/i18n';
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  DEFAULT_LOCATION,
  LOCATIONS,
} from '@/lib/constants';
import { colors, spacing, typography } from '@/lib/theme';

export default function AddItemModal() {
  return <AuthGate requireSession><AddItemModalContent /></AuthGate>;
}

function AddItemModalContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { householdId, loading, error: loadError, retry, addItem } = usePantryItems();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const { busy, run } = useItemMutation();
  const [error, setError] = useState<string | null>(null);

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
    if (!householdId) {
      setError(t('err_no_household'));
      return;
    }
    setError(null);
    await run(
      () => addItem({ name: trimmed, category, location }),
      () => router.back(),
      (failure) => setError(t(itemSaveErrorKey(failure))),
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
        <Text style={styles.title}>{t('item_add_title')}</Text>
        {loadError ? <View>
          <Text accessibilityRole="alert">{t(loadError)}</Text>
          <Button label={t('common_retry')} onPress={() => { void retry(); }} />
        </View> : null}

        <Input
          label={t('item_name')}
          placeholder={t('item_name_placeholder')}
          maxLength={ITEM_NAME_MAX}
          editable={!busy}
          value={name}
          onChangeText={setName}
          autoFocus
          testID="add-item-name"
          error={error}
        />

        <Text style={styles.sectionLabel}>{t('item_category')}</Text>
        <OptionChips
          options={[...CATEGORIES]}
          value={category}
          onChange={setCategory}
          labelFor={(k) => t(`cat_${k}`)}
          testIDPrefix="add-item-category"
        />

        <View style={{ height: spacing.md }} />

        <Text style={styles.sectionLabel}>{t('item_location')}</Text>
        <OptionChips
          options={[...LOCATIONS]}
          value={location}
          onChange={setLocation}
          labelFor={(k) => t(`loc_${k}`)}
          testIDPrefix="add-item-location"
        />

        <View style={styles.actions}>
          <Button
            label={t('common_cancel')}
            onPress={() => router.back()}
            variant="secondary"
            disabled={busy}
            style={{ flex: 1 }}
            testID="add-item-cancel"
          />
          <View style={{ width: spacing.md }} />
          <Button
            label={t('item_add_button')}
            onPress={onSave}
            loading={busy}
            disabled={loading || !householdId || !!loadError}
            style={{ flex: 1 }}
            testID="add-item-save"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
});
