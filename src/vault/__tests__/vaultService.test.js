/**
 * Vault service with SecureStore + SQLite mocked.
 */
const mockStore = new Map();
const mockRows = new Map();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (k, v) => { mockStore.set(k, v); }),
  getItemAsync: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  deleteItemAsync: jest.fn(async (k) => { mockStore.delete(k); }),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n) => Uint8Array.from({ length: n }, (_, i) => i + 1),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: async () => ({ success: true }),
}));

jest.mock('../../db/database', () => {
  const db = {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async (sql, params = []) => {
      if (String(sql).startsWith('INSERT')) {
        const [id, type, title, website, username, tags, connector_id, managed_by_connector, has_totp, created_at, updated_at] = params;
        mockRows.set(id, { id, type, title, website, username, tags, connector_id, managed_by_connector, has_totp, created_at, updated_at });
      } else if (String(sql).startsWith('UPDATE')) {
        const id = params[params.length - 1];
        const existing = mockRows.get(id);
        if (!existing) return;
        if (params.length === 4) {
          existing.title = params[0];
          existing.username = params[1];
          existing.updated_at = params[2];
        } else {
          existing.title = params[0];
          existing.website = params[1];
          existing.username = params[2];
          existing.tags = params[3];
          existing.has_totp = params[4];
          existing.updated_at = params[5];
        }
        mockRows.set(id, existing);
      } else if (String(sql).startsWith('DELETE')) {
        mockRows.delete(params[0]);
      }
    }),
    getAllAsync: jest.fn(async () => Array.from(mockRows.values()).sort((a, b) => b.updated_at - a.updated_at)),
    getFirstAsync: jest.fn(async (sql, params = []) => {
      if (String(sql).includes('connector_id')) {
        return Array.from(mockRows.values()).find((r) => r.connector_id === params[0] && r.managed_by_connector === 1) || null;
      }
      return mockRows.get(params[0]) || null;
    }),
  };
  return {
    getDb: async () => db,
    getApiKey: jest.fn(async () => ({ success: true, data: null })),
    storeApiKey: jest.fn(async () => ({ success: true })),
    deleteApiKey: jest.fn(async () => ({ success: true })),
  };
});

import {
  createVaultItem, listVaultItems, revealVaultSecret, deleteVaultItem,
  syncGithubConnectorVaultItem, removeGithubConnectorVaultItem, getVaultSecuritySummary,
} from '../vaultService';
import { unlockVault, lockVault } from '../vaultAuth';

beforeEach(() => {
  mockStore.clear();
  mockRows.clear();
  lockVault();
});

describe('vaultService', () => {
  test('creates login with secret only in SecureStore', async () => {
    const created = await createVaultItem({
      type: 'login',
      title: 'Example',
      website: 'https://example.com',
      username: 'neo',
      secret: { password: 's3cret!', totpSecret: 'JBSWY3DPEHPK3PXP' },
    });
    expect(created.success).toBe(true);
    expect(created.data.title).toBe('Example');
    expect(created.data.hasTotp).toBe(true);

    const listed = await listVaultItems();
    expect(listed.data).toHaveLength(1);
    expect(JSON.stringify(listed.data)).not.toMatch(/s3cret/);

    await unlockVault();
    const revealed = await revealVaultSecret(created.data.id);
    expect(revealed.success).toBe(true);
    expect(revealed.data.password).toBe('s3cret!');
    expect(mockStore.size).toBe(1);
  });

  test('delete removes metadata and secret', async () => {
    const created = await createVaultItem({
      type: 'api_key',
      title: 'Key',
      secret: { token: 'tok_abc' },
    });
    await deleteVaultItem(created.data.id);
    expect((await listVaultItems()).data).toHaveLength(0);
    expect(mockStore.size).toBe(0);
  });

  test('connector token sync is managed', async () => {
    await syncGithubConnectorVaultItem({
      token: 'gho_secret',
      login: 'zenas',
      name: 'Zenas',
      scopes: ['repo'],
    });
    const listed = await listVaultItems();
    expect(listed.data[0].managedByConnector).toBe(true);
    expect(listed.data[0].title).toContain('zenas');
    const del = await deleteVaultItem(listed.data[0].id);
    expect(del.success).toBe(false);
    await removeGithubConnectorVaultItem();
    expect((await listVaultItems()).data).toHaveLength(0);
  });

  test('security summary counts items', async () => {
    await createVaultItem({ type: 'secure_note', title: 'N', secret: { body: 'x' } });
    await unlockVault();
    const sum = await getVaultSecuritySummary();
    expect(sum.data.total).toBe(1);
  });
});
