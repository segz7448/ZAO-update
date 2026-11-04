/**
 * In-memory + JSON file store for purchased demo VPNs and active selection.
 * Proxy credentials stay on the server only.
 */
const fs = require('fs');
const path = require('path');

function createVpnStore(dataDir) {
  const file = path.join(dataDir, 'vpn-store.json');
  let state = { items: [], activeId: null };

  function load() {
    try {
      if (fs.existsSync(file)) {
        state = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!state.items) state.items = [];
      }
    } catch (_) {
      state = { items: [], activeId: null };
    }
  }

  function save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (_) { /* best-effort */ }
  }

  load();

  return {
    list() { return state.items.slice(); },
    get(id) { return state.items.find((i) => i.id === id) || null; },
    add(item) { state.items.push(item); save(); return item; },
    update(item) {
      const i = state.items.findIndex((x) => x.id === item.id);
      if (i >= 0) state.items[i] = item;
      save();
      return item;
    },
    remove(id) {
      const before = state.items.length;
      state.items = state.items.filter((x) => x.id !== id);
      if (state.activeId === id) state.activeId = null;
      save();
      return state.items.length < before;
    },
    getActiveId() { return state.activeId; },
    setActive(id) {
      if (id && !state.items.some((x) => x.id === id)) return false;
      state.activeId = id || null;
      save();
      return true;
    },
    getActive() {
      if (!state.activeId) return null;
      return state.items.find((x) => x.id === state.activeId) || null;
    },
    /** Public view — strip proxy password from API responses when desired */
    publicView(item) {
      if (!item) return null;
      const { proxy, ...rest } = item;
      return {
        ...rest,
        proxy: proxy ? { server: proxy.server, username: proxy.username, hasPassword: true } : null,
      };
    },
  };
}

module.exports = { createVpnStore };
