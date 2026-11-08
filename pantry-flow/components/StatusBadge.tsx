import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography, StatusKey } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';

export function StatusBadge({ status }: { status: StatusKey }) {
  const { t } = useTranslation();
  const fg = colors.status[status];
  const bg = colors.statusBg[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }]}>{t(`status_${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { ...typography.small, fontWeight: '600' },
});
