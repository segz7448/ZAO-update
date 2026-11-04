/**
 * Inject enabled plugin instructions into the agent request and enforce
 * the plugin's tool allowlist when a plugin is selected or @mentioned.
 */
import { getPluginByName, bumpPluginUsage, listPlugins } from './pluginService';

const MENTION_RE = /(?:^|\s)@([A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Z][A-Za-z0-9_-]*){0,5})/g;

/**
 * Extract @PluginName mentions from user text (case-insensitive match later).
 */
export function extractPluginMentions(text) {
  const names = [];
  const s = String(text || '');
  let m;
  const re = new RegExp(MENTION_RE.source, 'g');
  while ((m = re.exec(s))) {
    names.push(m[1].trim());
  }
  return [...new Set(names)];
}

/**
 * Resolve which plugin to apply: explicit pick wins, else first @mention
 * that matches an enabled installed plugin.
 */
export async function resolveActivePlugin({ selectedPluginId, userText } = {}) {
  if (selectedPluginId) {
    const { getPlugin } = await import('./pluginService');
    const r = await getPlugin(selectedPluginId);
    if (r.data?.enabled) return r.data;
  }
  const mentions = extractPluginMentions(userText);
  for (const name of mentions) {
    const r = await getPluginByName(name);
    if (r.data) return r.data;
    // try without spaces
    const compact = name.replace(/\s+/g, '');
    const all = await listPlugins();
    const hit = (all.data || []).find(
      (p) => p.enabled && p.name.replace(/\s+/g, '').toLowerCase() === compact.toLowerCase()
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Build system-prompt appendix + tool filter for an active plugin.
 */
export function buildPluginContext(plugin) {
  if (!plugin) return { systemAppendix: '', allowedTools: null, plugin: null };
  const scheduleNotes = (plugin.triggers || [])
    .filter((t) => t.type === 'schedule')
    .map((t) => `Scheduled trigger (${t.cron || 'cron'}) is stored but not yet running on the server.`);
  const appendix = [
    '',
    `## Active plugin: ${plugin.name}`,
    plugin.description || '',
    '',
    plugin.instructions,
    '',
    scheduleNotes.length ? `Note: ${scheduleNotes.join(' ')}` : null,
  ].filter((x) => x != null).join('\n');

  return {
    systemAppendix: appendix,
    allowedTools: new Set(plugin.allowedTools || []),
    plugin,
  };
}

/**
 * Filter tool definitions / calls to the plugin allowlist when present.
 */
export function enforcePluginToolAllowlist(tools, allowedTools) {
  if (!allowedTools) return tools;
  if (Array.isArray(tools)) {
    return tools.filter((t) => {
      const name = t?.function?.name || t?.name || t;
      return allowedTools.has(name);
    });
  }
  return tools;
}

export async function applyPluginToRequest({ selectedPluginId, userText, systemPrompt, tools }) {
  const plugin = await resolveActivePlugin({ selectedPluginId, userText });
  if (!plugin) {
    return { systemPrompt, tools, plugin: null };
  }
  const ctx = buildPluginContext(plugin);
  await bumpPluginUsage(plugin.id).catch(() => {});
  return {
    systemPrompt: `${systemPrompt || ''}${ctx.systemAppendix}`,
    tools: enforcePluginToolAllowlist(tools, ctx.allowedTools),
    plugin,
  };
}
