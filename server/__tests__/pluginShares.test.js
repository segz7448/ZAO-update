/**
 * Plugin share store + route smoke tests (plain node assert, no jest).
 * Run: node server/__tests__/pluginShares.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const http = require('http');
const { createPluginShareStore } = require('../plugins/store');
const { registerPluginShareRoutes } = require('../plugins/routes');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zao-plugin-share-'));

function runStoreTests() {
  const store = createPluginShareStore(tmp);
  const manifest = {
    name: 'Demo Plugin',
    description: 'Does demos',
    allowedTools: ['web_search'],
    requiredConnectors: ['github'],
    permissions: ['network'],
  };
  const snap = store.createShare({
    pluginId: 'plug_1',
    ownerId: 'owner_a',
    ownerName: 'Ada',
    manifest,
    allowReshare: false,
  });
  assert.ok(snap.token);
  assert.strictEqual(snap.manifest.name, 'Demo Plugin');
  assert.strictEqual(snap.revoked, false);

  const fetched = store.getShare(snap.token);
  assert.strictEqual(fetched.id, snap.id);

  let r = store.recordInstall(snap.token, 'user_1');
  assert.strictEqual(r.created, true);
  assert.strictEqual(r.stats.installs, 1);
  assert.strictEqual(r.stats.active, 1);

  r = store.recordInstall(snap.token, 'user_1');
  assert.strictEqual(r.created, false, 'dedupe same recipient');
  assert.strictEqual(r.stats.installs, 1);

  r = store.recordInstall(snap.token, 'user_2');
  assert.strictEqual(r.stats.installs, 2);
  assert.strictEqual(r.stats.active, 2);

  r = store.recordUninstall(snap.token, 'user_1');
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.stats.active, 1);
  assert.strictEqual(r.stats.installs, 2);

  const stats = store.getStatsForPlugin('plug_1', 'owner_a');
  assert.strictEqual(stats.installs, 2);
  assert.strictEqual(stats.active, 1);
  assert.strictEqual(stats.sparkline.length, 14);

  store.revokeShare(snap.token, 'owner_a');
  assert.throws(() => store.recordInstall(snap.token, 'user_3'), (e) => e.code === 'REVOKED');

  // wrong owner cannot revoke
  const snap2 = store.createShare({
    pluginId: 'plug_1', ownerId: 'owner_a', ownerName: 'Ada', manifest,
  });
  assert.throws(() => store.revokeShare(snap2.token, 'intruder'), (e) => e.code === 'FORBIDDEN');

  console.log('store tests ok');
}

function request(server, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port: addr.port,
      path: urlPath,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: buf, json: () => {
          try { return JSON.parse(buf); } catch (_) { return null; }
        } });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runRouteTests() {
  const app = express();
  app.use(express.json());
  const api = registerPluginShareRoutes(app, { dataDir: path.join(tmp, 'routes') });
  app.get('/p/:token', api.publicHandlers.page);
  app.get('/p/:token/json', api.publicHandlers.json);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const manifest = { name: 'Share Me', description: 'Hello', allowedTools: ['web_search'] };
  const create = await request(server, 'POST', '/plugins/plug_x/share', {
    ownerId: 'o1', ownerName: 'Zenas', manifest, allowReshare: true,
  });
  assert.strictEqual(create.status, 200);
  const created = create.json();
  assert.ok(created.data.token);
  assert.ok(created.data.url.includes('/p/'));
  assert.ok(created.data.deepLink.startsWith('zao://plugin/'));
  const token = created.data.token;

  const page = await request(server, 'GET', `/p/${token}`);
  assert.strictEqual(page.status, 200);
  assert.ok(page.body.includes('Open in ZAO'));
  assert.ok(page.body.includes('Share Me'));

  const json = await request(server, 'GET', `/p/${token}/json`);
  assert.strictEqual(json.status, 200);
  assert.strictEqual(json.json().data.manifest.name, 'Share Me');

  const install = await request(server, 'POST', `/plugins/share/${token}/install`, { recipientId: 'r1' });
  assert.strictEqual(install.status, 200);
  assert.strictEqual(install.json().data.created, true);
  assert.strictEqual(install.json().data.stats.installs, 1);

  const stats = await request(server, 'GET', '/plugins/plug_x/share/stats?ownerId=o1');
  assert.strictEqual(stats.status, 200);
  assert.strictEqual(stats.json().data.installs, 1);

  const revoke = await request(server, 'POST', `/plugins/share/${token}/revoke`, { ownerId: 'o1' });
  assert.strictEqual(revoke.status, 200);

  const gone = await request(server, 'GET', `/p/${token}`);
  assert.strictEqual(gone.status, 404);

  await new Promise((r) => server.close(r));
  console.log('route tests ok');
}

(async () => {
  runStoreTests();
  await runRouteTests();
  console.log('ALL PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
