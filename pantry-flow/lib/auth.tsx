import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  retrySession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<'signed_in' | 'confirmation_required'>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);

  const retrySession = async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase.auth.getSession();
      if (err) throw err;
      if (mounted.current && request === generation.current) setSession(data.session);
    } catch {
      if (mounted.current && request === generation.current) {
        setSession(null); setError('err_restore_session');
      }
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void retrySession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      generation.current++;
      if (mounted.current) {
        setSession(next); setError(null); setLoading(false);
      }
    });
    return () => {
      mounted.current = false; generation.current++;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) throw err;
    if (!data.session) throw new Error('No session returned');
    generation.current++;
    if (mounted.current) { setSession(data.session); setError(null); setLoading(false); }
  };
  const signUp: AuthContextType['signUp'] = async (name, email, password) => {
    if (!name.trim() || Array.from(name.trim()).length > 100) throw new Error('Invalid name');
    const { data, error: err } = await supabase.auth.signUp({
      email, password, options: { data: { name: name.trim() } },
    });
    if (err) throw err;
    if (!data.session) return 'confirmation_required';
    generation.current++;
    if (mounted.current) { setSession(data.session); setError(null); setLoading(false); }
    return 'signed_in';
  };
  const signOut = async () => {
    const { error: err } = await supabase.auth.signOut();
    if (err) throw err;
    generation.current++;
    if (mounted.current) { setSession(null); setError(null); }
  };
  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, error,
    retrySession, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
