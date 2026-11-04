import { checkSharedPluginCompatibility } from '../shareCompat';
import { validatePluginManifest, setKnownTools } from '../schema';

describe('shared plugin compatibility', () => {
  beforeAll(() => {
    setKnownTools(['web_search', 'web_fetch', 'time_get_current']);
  });

  test('ok when tools and connectors known', () => {
    const snap = {
      token: 't',
      ownerName: 'Ada',
      allowReshare: false,
      revoked: false,
      manifest: {
        name: 'Demo',
        icon: 'plugins',
        description: 'A demo plugin for tests',
        instructions: 'You help with demos and always stay concise in replies.',
        allowedTools: ['web_search'],
        requiredConnectors: [],
        permissions: [],
      },
    };
    const r = checkSharedPluginCompatibility(snap, {
      knownTools: new Set(['web_search', 'web_fetch']),
      availableConnectorIds: ['github'],
    });
    expect(r.ok).toBe(true);
  });

  test('fails when tool missing from app version', () => {
    const snap = {
      token: 't',
      revoked: false,
      manifest: {
        name: 'Future',
        icon: 'plugins',
        description: 'Needs a future tool',
        instructions: 'You use a tool that does not exist yet in this build.',
        allowedTools: ['future_tool_xyz'],
        requiredConnectors: [],
      },
    };
    const r = checkSharedPluginCompatibility(snap, {
      knownTools: new Set(['web_search']),
      availableConnectorIds: [],
    });
    expect(r.ok).toBe(false);
    expect(r.missingTools).toContain('future_tool_xyz');
  });

  test('revoked share is incompatible', () => {
    const r = checkSharedPluginCompatibility({
      revoked: true,
      manifest: {
        name: 'X',
        icon: 'plugins',
        description: 'x',
        instructions: 'xxxxxxxxxxxxxxxxxxxx',
        allowedTools: ['web_search'],
      },
    }, { knownTools: new Set(['web_search']) });
    expect(r.ok).toBe(false);
  });
});

describe('manifest still validates', () => {
  test('created plugin shape', () => {
    const v = validatePluginManifest({
      name: 'Mine',
      icon: 'plugins',
      description: 'Private plugin',
      instructions: 'You are a private helper with enough instruction text.',
      allowedTools: ['web_search'],
      requiredConnectors: [],
    }, { knownTools: new Set(['web_search']) });
    expect(v.ok).toBe(true);
  });
});
