import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthGate } from '@/components/AuthGate';
import { useTranslation } from '@/lib/i18n';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { t } = useTranslation();


  return (
    <AuthGate requireSession>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav_pantry'),
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="cube-outline" size={size} color={focused ? colors.primary : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav_settings'),
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="settings-outline" size={size} color={focused ? colors.primary : colors.textMuted} />
          ),
        }}
      />
    </Tabs>
    </AuthGate>
  );
}
