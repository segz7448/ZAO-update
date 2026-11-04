jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n) => {
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) a[i] = (i * 17 + 3) % 256;
    return a;
  },
  digestStringAsync: async (_algo, value) => `hash:${String(value).length}`,
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  randomUUID: () => '00000000-0000-4000-8000-000000000001',
}));
