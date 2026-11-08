import { AuthGate } from '@/components/AuthGate';
import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Redirect href="/(tabs)" />;
  return <AuthGate><Stack screenOptions={{ headerShown: false }} /></AuthGate>;
}
