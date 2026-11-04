import { vpnClient, VPN_MAX } from './vpnClient';
import { localVpn } from './localDemoStore';

async function withFallback(serverCall, localCall) {
  const r = await serverCall();
  if (r?.success) return { ...r, source: r.localDemo ? 'local' : 'server' };
  if (r?.offline || r?.error === 'NOT_CONFIGURED' || r?.error === 'NETWORK') {
    const local = await localCall();
    return { ...local, source: 'local', serverError: r.error };
  }
  return r;
}

export const vpn = {
  MAX: VPN_MAX,
  status: () => withFallback(() => vpnClient.status(), () => localVpn.status()),
  locations: () => withFallback(() => vpnClient.locations(), () => localVpn.locations()),
  plans: () => withFallback(() => vpnClient.plans(), () => localVpn.plans()),
  quote: (b) => withFallback(() => vpnClient.quote(b), () => localVpn.quote(b)),
  list: () => withFallback(() => vpnClient.list(), () => localVpn.list()),
  purchase: (b) => withFallback(() => vpnClient.purchase(b), () => localVpn.purchase(b)),
  renew: (id, planId) => withFallback(() => vpnClient.renew(id, planId), () => localVpn.renew(id, planId)),
  change: (id, regionId) => withFallback(() => vpnClient.change(id, regionId), () => localVpn.change(id, regionId)),
  release: (id) => withFallback(() => vpnClient.release(id), () => localVpn.release(id)),
  remove: (id) => withFallback(() => vpnClient.remove(id), () => localVpn.remove(id)),
  activate: (id) => withFallback(() => vpnClient.activate(id), () => localVpn.activate(id)),
  deactivate: () => withFallback(() => vpnClient.deactivate(), () => localVpn.deactivate()),
  usage: (id) => withFallback(() => vpnClient.usage(id), () => localVpn.usage(id)),
  reputation: (id) => withFallback(() => vpnClient.reputation(id), () => localVpn.status().then((s) => ({
    success: true,
    data: s.data?.reputation,
  }))),
  forceLowTrust: (id, on) => localVpn.forceLowTrust(id, on),
};

export { VPN_MAX };
