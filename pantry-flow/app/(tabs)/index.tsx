import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { PantryItem } from '@/components/PantryItem';
import { Button } from '@/components/Button';
import { usePantryItems } from '@/hooks/usePantryItems';
import { useSingleOpen } from '@/hooks/useSingleOpen';
import { useTranslation } from '@/lib/i18n';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function PantryScreen() {
  const router = useRouter();
  const openEditor = useSingleOpen();
  const { t } = useTranslation();
  const { items, loading, error, retry } = usePantryItems();

  const showLoading = loading && items.length === 0;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">{t(error)}</Text>
        <Button label={t('common_retry')} onPress={() => { void retry(); }} />
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

  return (
    <View style={styles.container} testID="pantry-screen">
      {items.length === 0 ? (
        <EmptyState
          title={t('empty_pantry_title')}
          subtitle={t('empty_pantry_subtitle')}
          ctaLabel={t('empty_pantry_cta')}
          onCtaPress={() => router.push('/add-item')}
        />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => (
              <PantryItem
                item={item}
                onPress={() => openEditor(`/edit-item/${item.id}`)}
              />
            )}
            contentContainerStyle={styles.list}
          />
        </>
      )}

      <Pressable
        onPress={() => router.push('/add-item')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('item_add_button')}
        testID="pantry-fab-add"
      >
        <Ionicons name="add" size={28} color={colors.primaryOn} />
      </Pressable>
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
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2.5,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPressed: { opacity: 0.9 },
});
