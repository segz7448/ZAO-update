/**
 * Plugin manifest schema + validator. Tools must be in the app's real
 * TOOL_REGISTRY; connectors must be known registry ids.
 */
import { CONNECTORS } from '../connectors/registry';
import { AREA_ICONS } from '../ui/icons';

/** Known tool names — kept in sync via tests against TOOL_REGISTRY. */
let _knownTools = null;

export function setKnownTools(tools) {
  _knownTools = new Set(tools);
}

export function getKnownTools() {
  return _knownTools;
}

const CONNECTOR_IDS = new Set(CONNECTORS.map((c) => c.id));

export const PLUGIN_ICON_KEYS = Object.keys(AREA_ICONS).filter(
  (k) => k.startsWith('plugin_') || ['coding', 'search', 'browser', 'github', 'memory', 'planning'].includes(k)
);

/**
 * @typedef {object} PluginManifest
 * @property {string} name
 * @property {string} icon
 * @property {string} description
 * @property {string} instructions
 * @property {string[]} requiredConnectors
 * @property {string[]} allowedTools
 * @property {{type:'manual'|'schedule', cron?: string, note?: string}[]} [triggers]
 * @property {string[]} [examplePrompts]
 */

/**
 * Validate a plugin manifest. Returns { ok, errors[], normalized? }.
 */
export function validatePluginManifest(raw, { knownTools } = {}) {
  const errors = [];
  const m = raw && typeof raw === 'object' ? raw : null;
  if (!m) return { ok: false, errors: ['MANIFEST_REQUIRED'] };

  const name = String(m.name || '').trim();
  if (!name || name.length < 2) errors.push('NAME_REQUIRED');
  if (name.length > 64) errors.push('NAME_TOO_LONG');

  const icon = String(m.icon || '').trim();
  if (!icon) errors.push('ICON_REQUIRED');
  else if (!AREA_ICONS[icon] && !icon.startsWith('plugin_') && icon !== 'plugins') errors.push('ICON_UNKNOWN');

  const description = String(m.description || '').trim();
  if (!description) errors.push('DESCRIPTION_REQUIRED');

  const instructions = String(m.instructions || '').trim();
  if (!instructions || instructions.length < 20) errors.push('INSTRUCTIONS_REQUIRED');

  const requiredConnectors = Array.isArray(m.requiredConnectors) ? m.requiredConnectors : [];
  for (const id of requiredConnectors) {
    if (!CONNECTOR_IDS.has(id)) errors.push(`CONNECTOR_UNKNOWN:${id}`);
  }

  const allowedTools = Array.isArray(m.allowedTools) ? m.allowedTools : [];
  if (!allowedTools.length) errors.push('TOOLS_REQUIRED');
  const tools = knownTools || _knownTools;
  if (tools) {
    for (const t of allowedTools) {
      if (!tools.has(t)) errors.push(`TOOL_UNKNOWN:${t}`);
    }
  }

  const triggers = Array.isArray(m.triggers) ? m.triggers : [{ type: 'manual' }];
  for (const tr of triggers) {
    if (!tr || (tr.type !== 'manual' && tr.type !== 'schedule')) {
      errors.push('TRIGGER_INVALID');
    }
    if (tr?.type === 'schedule' && !tr.cron) errors.push('SCHEDULE_CRON_REQUIRED');
  }

  const examplePrompts = Array.isArray(m.examplePrompts)
    ? m.examplePrompts.map((s) => String(s)).filter(Boolean)
    : [];
  const permissions = Array.isArray(m.permissions)
    ? m.permissions.map((s) => String(s)).filter(Boolean)
    : [];

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    normalized: {
      name,
      icon,
      description,
      instructions,
      requiredConnectors,
      allowedTools: [...new Set(allowedTools)],
      triggers,
      examplePrompts,
      permissions,
    },
  };
}
