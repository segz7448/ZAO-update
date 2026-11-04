/**
 * Active-VPN proxy config for Playwright and outbound fetches.
 */
function getActiveProxyConfig(store) {
  const active = store.getActive();
  if (!active?.proxy?.server) return null;
  // Playwright proxy shape
  return {
    server: active.proxy.server,
    username: active.proxy.username,
    password: active.proxy.password,
    vpnId: active.id,
    ip: active.ip,
  };
}

/**
 * Convert to an HTTP(S)_PROXY URL for undici/node-fetch style agents.
 */
function proxyUrlFromConfig(cfg) {
  if (!cfg?.server) return null;
  try {
    const u = new URL(cfg.server);
    if (cfg.username) {
      u.username = cfg.username;
      u.password = cfg.password || '';
    }
    return u.toString();
  } catch (_) {
    return null;
  }
}

module.exports = { getActiveProxyConfig, proxyUrlFromConfig };
