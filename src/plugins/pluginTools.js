/**
 * Agent tools for drafting and installing plugins from chat.
 * plugin_create → validates + returns a preview payload (does NOT install).
 * plugin_install → persists a previously drafted (or refined) manifest.
 */
import { validatePluginManifest, setKnownTools, getKnownTools } from './schema';
import { installPlugin } from './pluginService';
function knownToolSet() {
  try {
    // Lazy require avoids circular init with toolOrchestrator.js
    // eslint-disable-next-line global-require
    const { TOOL_REGISTRY } = require('../services/toolOrchestrator');
    return new Set(Object.keys(TOOL_REGISTRY || {}));
  } catch (_) {
    return getKnownTools() || new Set();
  }
}

function ensureKnownTools() {
  const tools = knownToolSet();
  if (tools && tools.size) setKnownTools([...tools]);
}

/**
 * Draft/validate a plugin manifest for the inline preview card.
 * Does not persist. Returns { success, data: { pluginPreview } }.
 */
export async function pluginCreate(args = {}) {
  ensureKnownTools();
  const raw = {
    name: args.name,
    icon: args.icon || 'plugins',
    description: args.description,
    instructions: args.instructions,
    requiredConnectors: args.requiredConnectors || [],
    allowedTools: args.allowedTools || [],
    triggers: args.triggers || [{ type: 'manual' }],
    examplePrompts: args.examplePrompts || [],
    permissions: args.permissions || [],
  };
  const v = validatePluginManifest(raw);
  if (!v.ok) {
    return {
      success: false,
      error: `Manifest invalid: ${v.errors.join(', ')}`,
      data: { errors: v.errors, draft: raw },
    };
  }
  const manifest = v.normalized;
  return {
    success: true,
    data: {
      pluginPreview: {
        status: 'draft',
        manifest,
        permissions: manifest.permissions || args.permissions || [],
        examplePrompts: manifest.examplePrompts || [],
        requiredConnectors: manifest.requiredConnectors || [],
        allowedTools: manifest.allowedTools || [],
      },
    },
  };
}

/**
 * Install a drafted plugin (source='created').
 */
export async function pluginInstall(args = {}) {
  ensureKnownTools();
  const raw = args.manifest || args;
  const v = validatePluginManifest(raw);
  if (!v.ok) {
    return { success: false, error: `Manifest invalid: ${v.errors.join(', ')}`, data: { errors: v.errors } };
  }
  const installed = await installPlugin(v.normalized, { source: 'created', knownTools: knownToolSet() });
  if (!installed.success) {
    return { success: false, error: installed.error || 'INSTALL_FAILED' };
  }
  return {
    success: true,
    data: {
      plugin: installed.data,
      pluginPreview: {
        status: 'installed',
        pluginId: installed.data.id,
        manifest: v.normalized,
        permissions: v.normalized.permissions || [],
        examplePrompts: v.normalized.examplePrompts || [],
        requiredConnectors: v.normalized.requiredConnectors || [],
        allowedTools: v.normalized.allowedTools || [],
      },
    },
  };
}

export const PLUGIN_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'plugin_create',
      description: "Drafts a ZAO plugin from the person's request. Validates the manifest and returns a Plugin preview card (icon, name, description, tools, connectors, permissions, example prompts) with Install / Edit actions. Does NOT install — call plugin_install after the person confirms, or after refining via chat. Use when they say 'create a plugin', 'build a plugin that…', or 'help me make a plugin'.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short display name (2–64 chars)' },
          icon: { type: 'string', description: 'Icon key, e.g. plugins, plugin_code_reviewer, coding, search' },
          description: { type: 'string', description: 'One-line description shown in the preview and Plugins hub' },
          instructions: { type: 'string', description: 'System instructions the plugin injects when invoked (≥20 chars)' },
          requiredConnectors: { type: 'array', items: { type: 'string' }, description: 'Connector ids from the registry (e.g. github, gmail)' },
          allowedTools: { type: 'array', items: { type: 'string' }, description: 'Tool names from TOOL_REGISTRY the plugin may use' },
          examplePrompts: { type: 'array', items: { type: 'string' } },
          permissions: { type: 'array', items: { type: 'string' }, description: 'Human-readable permission bullets' },
          triggers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['manual', 'schedule'] },
                cron: { type: 'string' },
                note: { type: 'string' },
              },
            },
          },
        },
        required: ['name', 'description', 'instructions', 'allowedTools'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plugin_install',
      description: 'Installs a previously drafted plugin manifest to the device (SQLite, source=created). Call after the person taps Install on the preview card or explicitly confirms. Pass the full manifest.',
      parameters: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Full plugin manifest (same fields as plugin_create)',
          },
          name: { type: 'string' },
          icon: { type: 'string' },
          description: { type: 'string' },
          instructions: { type: 'string' },
          requiredConnectors: { type: 'array', items: { type: 'string' } },
          allowedTools: { type: 'array', items: { type: 'string' } },
          examplePrompts: { type: 'array', items: { type: 'string' } },
          permissions: { type: 'array', items: { type: 'string' } },
          triggers: { type: 'array' },
        },
        required: [],
      },
    },
  },
];
