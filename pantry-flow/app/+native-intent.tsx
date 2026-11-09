import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { clearInitialURL, createURL, getLinkingURL } from 'expo-linking';

function isConfirmationURL(value: string | null): value is string {
  if (!value) return false;
  try {
    const candidate = new URL(value);
    const expected = new URL(createURL('auth/callback'));
    return candidate.protocol === expected.protocol && candidate.host === expected.host &&
      candidate.pathname === expected.pathname && !candidate.username && !candidate.password;
  } catch { return false; }
}

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (Platform.OS !== 'android') return path;
  try {
    if (isConfirmationURL(path)) {
      clearInitialURL();
      return path;
    }
    // Router's Android bridge timeout can substitute the root during a cold
    // start. Expo's native listener retains the actual incoming link already.
    // Recover only our confirmation route, never overwrite another navigation.
    if (initial && (path === '/' || path === createURL('/'))) {
      const pending = getLinkingURL();
      if (isConfirmationURL(pending)) {
        clearInitialURL();
        return pending;
      }
    }
  } catch { /* Keep the original route if the native link API is unavailable. */ }
  return path;
}
