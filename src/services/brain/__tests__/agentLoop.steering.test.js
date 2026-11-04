/**
 * Agent-loop steering + scoped stop. Mocks decideRoute/verify so we don't
 * hit the network; focuses on run boundaries the composer depends on.
 */
jest.mock('../frontendBrain', () => ({
  BRAIN_ROUTES: {
    CHAT: 'chat',
    BROWSING: 'browsing',
    HIERARCHICAL_PLAN: 'hierarchical_plan',
    DEEP_RESEARCH: 'deep_research',
    QUICK_LOOKUP: 'quick_lookup',
  },
  decideRoute: jest.fn(),
}));
jest.mock('../../memory/projectInstructions', () => ({
  getProjectInstructionsBlock: jest.fn(async () => null),
}));
jest.mock('../../memory/autoMemoryNotes', () => ({
  getAutoMemoryBlock: jest.fn(async () => null),
}));
jest.mock('../../../db/database', () => ({
  getPreferences: jest.fn(async () => ({ success: true, data: {} })),
}));
jest.mock('../../time/timeTool', () => ({
  getCurrentTime: jest.fn(() => ({
    success: true,
    data: { formatted: 'Wed Nov 4 2026 04:00:00', zoneName: 'America/Los_Angeles' },
  })),
}));
jest.mock('../../backend/backendClient', () => ({
  sendMessage: jest.fn(),
}));

import { runAgentLoop } from '../agentLoop';
import { decideRoute, BRAIN_ROUTES } from '../frontendBrain';

describe('runAgentLoop steering + stop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('drains five rapid steers into the working message before chat', async () => {
    const steers = [
      { id: '1', text: 'also fix the empty state' },
      { id: '2', text: 'and add a loading skeleton' },
      { id: '3', text: 'keep the dark theme' },
      { id: '4', text: 'no toast spam' },
      { id: '5', text: 'ship tonight' },
    ];
    let pending = steers.slice();
    decideRoute.mockResolvedValueOnce({ route: BRAIN_ROUTES.CHAT, reason: 'done' });

    let seenMessage = null;
    const result = await runAgentLoop(
      { lastMessageText: 'Segregate probes', history: [{ role: 'user', content: 'Segregate probes' }] },
      {
        runChat: async (msg) => {
          seenMessage = msg;
          return { success: true, data: { content: 'Combined plan ready.', family: 'test', provider: 'test', modelId: 't' }, error: null };
        },
        runBrowsing: async () => ({ success: false, data: null, error: { message: 'no' } }),
        runHierarchicalPlan: async () => ({ success: false, data: null, error: { message: 'no' } }),
        runDeepResearch: async () => ({ success: false, data: null, error: { message: 'no' } }),
        runQuickLookup: async () => ({ success: false, data: null, error: { message: 'no' } }),
      },
      {
        drainSteers: () => {
          const out = pending;
          pending = [];
          return out;
        },
      },
    );

    expect(result.success).toBe(true);
    expect(seenMessage).toContain('Segregate probes');
    expect(seenMessage).toContain('also fix the empty state');
    expect(seenMessage).toContain('ship tonight');
    expect(seenMessage).toContain('Additional user input while working');
  });

  test('isCancelled between iterations returns stopped (resumable) note', async () => {
    let calls = 0;
    decideRoute.mockImplementation(async () => {
      calls += 1;
      return { route: BRAIN_ROUTES.QUICK_LOOKUP, reason: 'lookup' };
    });

    const result = await runAgentLoop(
      { lastMessageText: 'long task', history: [{ role: 'user', content: 'long task' }] },
      {
        runChat: async () => ({ success: true, data: { content: 'chat', family: 't', provider: 't', modelId: 't' }, error: null }),
        runBrowsing: async () => ({ success: true, data: { content: 'browse', family: 't', provider: 't', modelId: 't' }, error: null }),
        runHierarchicalPlan: async () => ({ success: true, data: { content: 'plan', family: 't', provider: 't', modelId: 't' }, error: null }),
        runDeepResearch: async () => ({ success: true, data: { content: 'research', family: 't', provider: 't', modelId: 't' }, error: null }),
        runQuickLookup: async () => ({ success: true, data: { content: 'lookup done', family: 't', provider: 't', modelId: 't' }, error: null }),
      },
      { isCancelled: () => calls >= 1 },
    );

    expect(result.success).toBe(true);
    expect(result.data.stopped).toBe(true);
    expect(result.data.content.toLowerCase()).toContain('continue');
  });

  test('stop is scoped: cancelling run A does not affect a later run B setup', async () => {
    // Pure controller contract covered in runController.test.js; here we
    // just assert the loop trusts isCancelled for THIS invocation only.
    decideRoute.mockResolvedValue({ route: BRAIN_ROUTES.CHAT, reason: 'ok' });
    const cancelledA = () => true;
    const cancelledB = () => false;

    const a = await runAgentLoop(
      { lastMessageText: 'a', history: [{ role: 'user', content: 'a' }] },
      { runChat: async () => ({ success: true, data: { content: 'should not run', family: 't', provider: 't', modelId: 't' }, error: null }),
        runBrowsing: async () => ({}), runHierarchicalPlan: async () => ({}), runDeepResearch: async () => ({}), runQuickLookup: async () => ({}) },
      { isCancelled: cancelledA },
    );
    expect(a.data.stopped).toBe(true);

    const b = await runAgentLoop(
      { lastMessageText: 'continue', history: [{ role: 'user', content: 'continue' }] },
      { runChat: async (msg) => ({ success: true, data: { content: `resumed:${msg}`, family: 't', provider: 't', modelId: 't' }, error: null }),
        runBrowsing: async () => ({}), runHierarchicalPlan: async () => ({}), runDeepResearch: async () => ({}), runQuickLookup: async () => ({}) },
      { isCancelled: cancelledB },
    );
    expect(b.data.stopped).toBeFalsy();
    expect(b.data.content).toContain('resumed:continue');
  });
});
