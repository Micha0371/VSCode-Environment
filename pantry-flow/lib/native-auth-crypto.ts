import { Platform } from 'react-native';
import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supply the native WebCrypto subset used by Supabase's PKCE implementation.
// Hashing/randomness delegate to Expo native APIs; never use Math.random/plain PKCE.
// This is not a general-purpose SubtleCrypto implementation.
export function installNativeAuthCrypto() {
  if (Platform.OS === 'web') return;
  const current = globalThis.crypto;
  const random = current?.getRandomValues?.bind(current) ?? getRandomValues;
  const nativeDigest = async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    if (name.toUpperCase() !== 'SHA-256') throw new Error('Native auth digest only supports SHA-256');
    return digest(CryptoDigestAlgorithm.SHA256, data);
  };
  if (!current?.getRandomValues || !current?.subtle?.digest) {
    const subtle = current?.subtle ?? { digest: nativeDigest };
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: Object.assign(Object.create(current ?? null), { getRandomValues: random, subtle }),
    });
  }
}

export function assertSecurePkce() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function' ||
      typeof globalThis.crypto?.subtle?.digest !== 'function' || typeof TextEncoder === 'undefined') {
    throw new Error('Secure email confirmation is unavailable');
  }
}

installNativeAuthCrypto();
