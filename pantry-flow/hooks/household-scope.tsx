import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useHousehold } from './useHousehold';

// One household lookup per signed-in user, shared by every data provider.
const HouseholdContext = createContext<ReturnType<typeof useHousehold> | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedHouseholdProvider key={user?.id ?? 'guest'}>{children}</ScopedHouseholdProvider>;
}
function ScopedHouseholdProvider({ children }: { children: ReactNode }) {
  const value = useHousehold();
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
export function useHouseholdScope() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHouseholdScope must be used within HouseholdProvider');
  return value;
}
