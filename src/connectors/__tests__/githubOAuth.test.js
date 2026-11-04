/**
 * GitHub OAuth Device Flow state machine — mocked fetch.
 */
import {
  createIdleState,
  reducePollResponse,
  requestDeviceCode,
  pollOnce,
  pollUntilDone,
  GITHUB_DEVICE_CODE_URL,
  GITHUB_DEVICE_TOKEN_URL,
} from '../githubOAuth';

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { githubOAuthClientId: 'Iv1.testclient' } },
}));

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('createIdleState', () => {
  test('starts idle when client id configured', () => {
    expect(createIdleState().status).toBe('idle');
  });
});

describe('reducePollResponse', () => {
  const base = {
    status: 'polling',
    userCode: 'ABCD-1234',
    verificationUri: 'https://github.com/login/device',
    deviceCode: 'dc',
    intervalSec: 5,
    expiresAt: Date.now() + 60_000,
    accessToken: null,
    tokenType: null,
    scope: 'repo',
    error: null,
    errorDescription: null,
  };

  test('access_token → connected', () => {
    const next = reducePollResponse(base, { access_token: 'gho_x', token_type: 'bearer', scope: 'repo' });
    expect(next.status).toBe('connected');
    expect(next.accessToken).toBe('gho_x');
  });

  test('authorization_pending → polling', () => {
    expect(reducePollResponse(base, { error: 'authorization_pending' }).status).toBe('polling');
  });

  test('slow_down increases interval', () => {
    const next = reducePollResponse(base, { error: 'slow_down' });
    expect(next.status).toBe('polling');
    expect(next.intervalSec).toBe(10);
  });

  test('expired_token → expired', () => {
    const next = reducePollResponse(base, { error: 'expired_token', error_description: 'gone' });
    expect(next.status).toBe('expired');
    expect(next.error).toBe('expired_token');
  });

  test('access_denied → denied', () => {
    const next = reducePollResponse(base, { error: 'access_denied' });
    expect(next.status).toBe('denied');
  });
});

describe('requestDeviceCode', () => {
  test('happy path', async () => {
    const fetchImpl = jest.fn(async (url) => {
      expect(url).toBe(GITHUB_DEVICE_CODE_URL);
      return jsonResponse({
        device_code: 'device',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      });
    });
    const state = await requestDeviceCode({ clientId: 'Iv1.testclient', fetchImpl });
    expect(state.status).toBe('awaiting_user');
    expect(state.userCode).toBe('WDJB-MJHT');
    expect(state.deviceCode).toBe('device');
  });

  test('missing client id → not_configured', async () => {
    const state = await requestDeviceCode({ clientId: '', fetchImpl: jest.fn() });
    expect(state.status).toBe('not_configured');
  });
});

describe('pollOnce / pollUntilDone', () => {
  test('pollOnce returns connected', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ access_token: 'gho_ok', token_type: 'bearer' }));
    const state = await pollOnce({
      ...createIdleState(),
      status: 'polling',
      deviceCode: 'dc',
      intervalSec: 1,
      expiresAt: Date.now() + 60_000,
    }, { clientId: 'Iv1.testclient', fetchImpl });
    expect(state.status).toBe('connected');
    expect(fetchImpl).toHaveBeenCalledWith(GITHUB_DEVICE_TOKEN_URL, expect.any(Object));
  });

  test('pollUntilDone handles pending then success', async () => {
    let n = 0;
    const fetchImpl = jest.fn(async () => {
      n += 1;
      if (n === 1) return jsonResponse({ error: 'authorization_pending' });
      if (n === 2) return jsonResponse({ error: 'slow_down' });
      return jsonResponse({ access_token: 'gho_final' });
    });
    const sleep = jest.fn(async () => {});
    const ticks = [];
    const final = await pollUntilDone({
      status: 'awaiting_user',
      deviceCode: 'dc',
      userCode: 'ABCD',
      verificationUri: 'https://github.com/login/device',
      intervalSec: 1,
      expiresAt: Date.now() + 60_000,
      accessToken: null,
      tokenType: null,
      scope: null,
      error: null,
      errorDescription: null,
    }, {
      clientId: 'Iv1.testclient',
      fetchImpl,
      sleep,
      onTick: (s) => ticks.push(s.status),
    });
    expect(final.status).toBe('connected');
    expect(final.accessToken).toBe('gho_final');
    expect(sleep).toHaveBeenCalled();
  });

  test('pollUntilDone respects abort', async () => {
    const signal = { aborted: true };
    const final = await pollUntilDone({
      status: 'polling',
      deviceCode: 'dc',
      intervalSec: 1,
      expiresAt: Date.now() + 60_000,
    }, { clientId: 'Iv1.testclient', fetchImpl: jest.fn(), sleep: async () => {}, signal });
    expect(final.status).toBe('error');
    expect(final.error).toBe('aborted');
  });
});
