import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from '@/lib/i18n';
import type { PantryItem as PantryItemData } from '@/hooks/usePantryItems';

interface Props {
  item: PantryItemData;
  onPress: () => void;
}

export function PantryItem({ item, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`pantry-item-${item.id}`}
    >
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t(`cat_${item.category}`)} · {t(`loc_${item.location}`)}
        </Text>
      </View>
      <StatusBadge status={item.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  left: { flex: 1, marginRight: spacing.md },
  name: { ...typography.heading, color: colors.text, marginBottom: 2 },
  meta: { ...typography.small, color: colors.textMuted },
});
