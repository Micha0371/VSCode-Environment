import { createURL } from 'expo-linking';
import { supabase } from './supabase';
import { assertSecurePkce } from './native-auth-crypto';

export function confirmationCode(params: Readonly<Record<string, unknown>>): string | null {
  if (params.error !== undefined || params.error_code !== undefined || params.error_description !== undefined) return null;
  const code = params.code;
  if (typeof code !== 'string' || !code || code.length > 2048 || /\s|[\u0000-\u001f\u007f]/u.test(code)) return null;
  return code;
}

// Only coalesce active requests. Completed codes/session tokens are not cached.
const exchanges = new Map<string, Promise<void>>();
export function confirmEmail(params: Readonly<Record<string, unknown>>): Promise<void> {
  const code = confirmationCode(params);
  if (!code) return Promise.reject(new Error('Invalid confirmation link'));
  const active = exchanges.get(code);
  if (active) return active;
  const request = (async () => {
    const current = await supabase.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session) throw new Error('Already signed in');
    // The persisted PKCE verifier binds the email link to this app installation.
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (result.error) throw result.error;
    if (!result.data.session) throw new Error('Confirmation returned no session');
  })();
  exchanges.set(code, request);
  void request.finally(() => exchanges.delete(code)).catch(() => undefined);
  return request;
}

let resendActive = false;
export async function resendConfirmation(email: string): Promise<void> {
  assertSecurePkce();
  const address = email.trim();
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)) throw new Error('Invalid email');
  if (resendActive) throw new Error('Confirmation request already running');
  resendActive = true;
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup', email: address,
      options: { emailRedirectTo: createURL('auth/callback') },
    });
    if (error) throw error;
  } finally { resendActive = false; }
}
