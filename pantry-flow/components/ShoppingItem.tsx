import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { ShoppingItem as ShoppingItemData } from '@/lib/shopping-data';

interface Props {
  item: ShoppingItemData;
  onToggle?: () => void;
  onPress?: () => void;
  pending?: boolean;
}

export function ShoppingItem({ item, onToggle, onPress, pending }: Props) {
  const checked = item.is_checked;
  const toggleDisabled = !onToggle || !!pending;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        disabled={toggleDisabled}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: toggleDisabled }}
        accessibilityLabel={item.name}
        testID={`shopping-toggle-${item.id}`}
      >
        <Ionicons
          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={checked ? colors.primary : colors.textMuted}
        />
      </Pressable>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.nameWrap, pressed && styles.pressed]}
        testID={`shopping-item-${item.id}`}
      >
        <Text style={[styles.name, checked && styles.nameDone]} numberOfLines={2}>
          {item.name}
        </Text>
      </Pressable>
    </View>
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
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  toggle: { padding: spacing.xs, marginRight: spacing.sm },
  nameWrap: { flex: 1, paddingVertical: spacing.sm },
  pressed: { opacity: 0.75 },
  name: { ...typography.body, color: colors.text },
  nameDone: { textDecorationLine: 'line-through', color: colors.textMuted },
});
