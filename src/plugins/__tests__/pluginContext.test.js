jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n) => new Uint8Array(n).map((_, i) => i + 1),
  digestStringAsync: async () => 'deadbeef',
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));
jest.mock('../../db/database', () => ({
  getDb: async () => null,
}));

import {
  extractPluginMentions,
  buildPluginContext,
  enforcePluginToolAllowlist,
} from '../pluginContext';

describe('extractPluginMentions', () => {
  test('finds @PluginName mentions', () => {
    expect(extractPluginMentions('hey @Skill Builder do this')).toEqual(['Skill Builder']);
    expect(extractPluginMentions('@Alpha and @Beta please')).toEqual(['Alpha', 'Beta']);
  });
  test('ignores email-like and bare words', () => {
    expect(extractPluginMentions('mail me at a@b.com')).toEqual([]);
    expect(extractPluginMentions('no mentions here')).toEqual([]);
  });
});

describe('buildPluginContext', () => {
  test('returns empty when no plugin', () => {
    expect(buildPluginContext(null)).toEqual({ systemAppendix: '', allowedTools: null, plugin: null });
  });
  test('appends name + instructions', () => {
    const plugin = {
      name: 'Demo',
      description: 'd',
      instructions: 'Always prefer web_search.',
      allowedTools: ['web_search'],
      triggers: [],
    };
    const ctx = buildPluginContext(plugin);
    expect(ctx.systemAppendix).toContain('Active plugin: Demo');
    expect(ctx.systemAppendix).toContain('Always prefer web_search.');
    expect(ctx.allowedTools.has('web_search')).toBe(true);
  });
});

describe('enforcePluginToolAllowlist', () => {
  test('filters array of tool schemas', () => {
    const tools = [
      { function: { name: 'web_search' } },
      { function: { name: 'github_list_repos' } },
      { name: 'plugin_create' },
    ];
    const out = enforcePluginToolAllowlist(tools, new Set(['web_search', 'plugin_create']));
    expect(out.map((t) => t.function?.name || t.name)).toEqual(['web_search', 'plugin_create']);
  });
  test('passthrough when allowlist null', () => {
    const tools = [{ name: 'a' }];
    expect(enforcePluginToolAllowlist(tools, null)).toBe(tools);
  });
});
