import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// Used once by PantryProvider; screens consume the shared provider instead.
export function useHousehold() {
  const { user } = useAuth();
  const userId = user?.id;
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshHousehold = useCallback(async () => {
    const request = ++generation.current;
    setHouseholdId(null);
    setError(null);
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('pantry_household_members')
        .select('household_id').eq('user_id', userId).single();
      if (err) throw err;
      if (!data?.household_id) throw new Error('No household');
      if (request === generation.current) setHouseholdId(data.household_id);
    } catch {
      if (request === generation.current) setError('err_no_household');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshHousehold();
    return () => { generation.current++; };
  }, [refreshHousehold]);

  return { householdId, loading, error, refreshHousehold };
}
