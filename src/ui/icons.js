/**
 * ZAO - central icon registry. One source of truth for every area / tool
 * glyph in the app: {glyph, family, color, label} or {brand, color, label}.
 * Rendered as iOS Settings-style tiles via <AppIconTile/>.
 * Brand connectors use Simple Icons SVG paths (CC0) — never letter badges.
 * Unknown keys resolve to a polished cube glyph fallback, never text.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { BRAND_ICONS, BRAND_KEY_FOR } from './brandIcons';

const I = 'ion'; const M = 'mdi';

export const AREA_ICONS = {
  coding: { glyph: 'code-slash', family: I, color: '#5856D6', label: 'Coding' },
  terminal: { glyph: 'terminal', family: I, color: '#3A3A3C', label: 'Terminal' },
  files: { glyph: 'folder', family: I, color: '#FF9F0A', label: 'Files' },
  filesystem: { glyph: 'folder', family: I, color: '#FF9F0A', label: 'Files' },
  browser: { glyph: 'compass', family: I, color: '#0A84FF', label: 'Browser' },
  github: { brand: 'github', color: '#181717', label: 'GitHub' },
  git: { glyph: 'git-branch', family: I, color: '#F05033', label: 'Git' },
  planning: { glyph: 'list', family: I, color: '#AF52DE', label: 'Planning' },
  todo: { glyph: 'checkbox', family: I, color: '#AF52DE', label: 'To-do' },
  search: { glyph: 'search', family: I, color: '#007AFF', label: 'Web search' },
  web: { glyph: 'globe', family: I, color: '#32ADE6', label: 'Web page' },
  time: { glyph: 'time', family: I, color: '#FF9500', label: 'Time' },
  reminders: { glyph: 'alarm', family: I, color: '#FF3B30', label: 'Reminders' },
  test: { glyph: 'flask', family: I, color: '#30B0C7', label: 'Tests' },
  data: { glyph: 'bar-chart', family: I, color: '#34C759', label: 'Data' },
  office: { glyph: 'document-text', family: I, color: '#2B579A', label: 'Document' },
  word: { glyph: 'microsoft-word', family: M, color: '#2B579A', label: 'Word' },
  excel: { glyph: 'microsoft-excel', family: M, color: '#217346', label: 'Excel' },
  powerpoint: { glyph: 'microsoft-powerpoint', family: M, color: '#D24726', label: 'PowerPoint' },
  csv: { glyph: 'grid', family: I, color: '#217346', label: 'CSV' },
  pdf: { glyph: 'file-pdf-box', family: M, color: '#E5252A', label: 'PDF' },
  background_session: { glyph: 'layers', family: I, color: '#5E5CE6', label: 'Background' },
  process: { glyph: 'pulse', family: I, color: '#30D158', label: 'Process' },
  server: { glyph: 'server', family: I, color: '#0A84FF', label: 'Dev server' },
  preview: { glyph: 'phone-portrait', family: I, color: '#64D2FF', label: 'Preview' },
  memory: { glyph: 'brain', family: M, color: '#FFCC00', label: 'Memory' },
  decision: { glyph: 'bookmark', family: I, color: '#FF9500', label: 'Decision log' },
  agent: { glyph: 'people', family: I, color: '#BF5AF2', label: 'Sub-agents' },
  worktree: { glyph: 'git-network', family: I, color: '#F05033', label: 'Worktree' },
  clipboard: { glyph: 'clipboard', family: I, color: '#8E8E93', label: 'Clipboard' },
  share: { glyph: 'share', family: I, color: '#007AFF', label: 'Share' },
  email: { glyph: 'mail', family: I, color: '#007AFF', label: 'Mail' },
  image: { glyph: 'image', family: I, color: '#FF2D55', label: 'Image' },
  zip: { glyph: 'archive', family: I, color: '#A2845E', label: 'Archive' },
  checkpoint: { glyph: 'time', family: I, color: '#34C759', label: 'Checkpoint' },
  general: { glyph: 'sparkles', family: I, color: '#636366', label: 'ZAO' },

  // Settings rows — real iOS Settings-style glyphs
  appearance: { glyph: 'contrast', family: I, color: '#5856D6', label: 'Appearance' },
  usage: { glyph: 'stats-chart', family: I, color: '#34C759', label: 'Usage' },
  connectors: { glyph: 'extension-puzzle', family: I, color: '#007AFF', label: 'Connectors' },
  vpn: { glyph: 'shield', family: I, color: '#30D158', label: 'VPN' },
  vault: { glyph: 'lock-closed', family: I, color: '#FF9F0A', label: 'Vault' },
  permissions: { glyph: 'shield-checkmark', family: I, color: '#5856D6', label: 'Permissions' },
  activity: { glyph: 'pulse', family: I, color: '#0A84FF', label: 'Activity' },
  appearance_auto: { glyph: 'contrast', family: I, color: '#5856D6', label: 'Auto' },
  appearance_light: { glyph: 'sunny', family: I, color: '#FF9500', label: 'Light' },
  appearance_dark: { glyph: 'moon', family: I, color: '#8E8E93', label: 'Dark' },

  // Vault item types — glyphs only, never letters
  vault_login: { glyph: 'globe', family: I, color: '#007AFF', label: 'Login' },
  vault_api_key: { glyph: 'key', family: I, color: '#FF9500', label: 'API key' },
  vault_secure_note: { glyph: 'document-text', family: I, color: '#AF52DE', label: 'Secure note' },
  vault_ssh_key: { glyph: 'ssh', family: M, color: '#3A3A3C', label: 'SSH key' },
  vault_connector_token: { glyph: 'link', family: I, color: '#0A84FF', label: 'Connector token' },
  vault_generator: { glyph: 'dice', family: I, color: '#5856D6', label: 'Generator' },
  vault_totp: { glyph: 'timer', family: I, color: '#FF2D55', label: 'One-time code' },

  // Connectors — brand SVG marks (see brandIcons.js)
  conn_github: { brand: 'github', color: '#181717', label: 'GitHub' },
  conn_cloudflare: { brand: 'cloudflare', color: '#F38020', label: 'Cloudflare' },
  conn_vercel: { brand: 'vercel', color: '#000000', label: 'Vercel' },
  conn_linear: { brand: 'linear', color: '#5E6AD2', label: 'Linear' },
  conn_gmail: { brand: 'gmail', color: '#EA4335', label: 'Gmail' },
  conn_outlook: { brand: 'outlook', color: '#0078D4', label: 'Outlook Mail' },
  conn_google_drive: { brand: 'google_drive', color: '#4285F4', label: 'Google Drive' },
  conn_onedrive: { brand: 'onedrive', color: '#0078D4', label: 'OneDrive' },
  conn_dropbox: { brand: 'dropbox', color: '#0061FF', label: 'Dropbox' },
  conn_shopify: { brand: 'shopify', color: '#7AB55C', label: 'Shopify' },
  conn_stripe: { brand: 'stripe', color: '#635BFF', label: 'Stripe' },
  conn_slack: { brand: 'slack', color: '#4A154B', label: 'Slack' },
  conn_notion: { brand: 'notion', color: '#000000', label: 'Notion' },
  conn_google_calendar: { brand: 'google_calendar', color: '#4285F4', label: 'Google Calendar' },
};

export const FALLBACK_ICON = { glyph: 'cube', family: I, color: '#8E8E93', label: 'Tool', fallback: true };

/** Host / website → brand registry key when known. */
const HOST_BRAND = [
  [/github\.com$/i, 'conn_github'],
  [/cloudflare\.com$/i, 'conn_cloudflare'],
  [/shopify\.com$/i, 'conn_shopify'],
  [/gmail\.com$|mail\.google\.com$/i, 'conn_gmail'],
  [/drive\.google\.com$|docs\.google\.com$/i, 'conn_google_drive'],
  [/outlook\.(com|live\.com|office\.com)$|office365\.com$/i, 'conn_outlook'],
  [/onedrive\.(live\.)?com$|1drv\.ms$/i, 'conn_onedrive'],
  [/dropbox\.com$/i, 'conn_dropbox'],
  [/vercel\.com$/i, 'conn_vercel'],
  [/stripe\.com$/i, 'conn_stripe'],
  [/slack\.com$/i, 'conn_slack'],
  [/notion\.(so|com)$/i, 'conn_notion'],
  [/calendar\.google\.com$/i, 'conn_google_calendar'],
  [/linear\.app$/i, 'conn_linear'],
];

/**
 * Vault item → icon key. Known brand hosts get SVG marks; otherwise a type glyph
 * (globe/key/note/ssh). Never a letter badge.
 */
export function vaultIconKey(item) {
  const host = String(item?.website || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
  if (host) {
    for (const [re, key] of HOST_BRAND) {
      if (re.test(host)) return key;
    }
  }
  if (item?.managed_by_connector || item?.type === 'connector_token') {
    if (item?.connector_id && AREA_ICONS[`conn_${item.connector_id}`]) {
      return `conn_${item.connector_id}`;
    }
    return 'vault_connector_token';
  }
  const byType = {
    login: 'vault_login',
    api_key: 'vault_api_key',
    secure_note: 'vault_secure_note',
    ssh_key: 'vault_ssh_key',
    connector_token: 'vault_connector_token',
  };
  return byType[item?.type] || 'vault';
}

/** Tool name -> registry key (specific first, then prefix families). */
export function toolIconKey(tool) {
  const t = String(tool || '');
  const exact = { docx_create: 'word', xlsx_create: 'excel', pptx_create: 'powerpoint', csv_create: 'csv', web_search: 'search', web_fetch: 'web',
    data_analyze_file: 'data', time_get_current: 'time', todo_write: 'todo', pc_run_tests: 'test', pc_log_decision: 'decision', pc_read_decisions: 'decision',
    dev_preview_screenshot: 'preview', phone_clipboard_copy: 'clipboard', phone_share_file: 'share', pc_fs_zip: 'zip', pc_fs_extract_zip: 'zip',
    pc_fs_list_checkpoints: 'checkpoint', pc_fs_rewind_checkpoint: 'checkpoint', pc_fs_check_syntax: 'coding', pc_fs_check_project_syntax: 'coding',
    pc_fs_edit_file: 'coding', pc_fs_scaffold_project: 'coding', agent_create_worktree: 'worktree', agent_list_worktrees: 'worktree' };
  if (exact[t]) return exact[t];
  const pre = [['github_', 'github'], ['pc_git_', 'git'], ['pc_fs_', 'files'], ['fs_', 'files'], ['pc_list_directory', 'files'], ['pc_pull_file', 'files'],
    ['pc_process_', 'process'], ['dev_server_', 'server'], ['terminal_', 'terminal'], ['pc_', 'terminal'], ['pdf_', 'pdf'], ['bgtask_', 'background_session'],
    ['reminder_', 'reminders'], ['agent_', 'agent'], ['memory_', 'memory'], ['browser_', 'browser'], ['email_', 'email'], ['mail_', 'email'], ['image_', 'image']];
  for (const [p, k] of pre) if (t.startsWith(p)) return k;
  return null;
}

/** Any area or tool key -> icon entry (never undefined). */
export function iconFor(key) {
  if (!key) return FALLBACK_ICON;
  const k = String(key).toLowerCase();
  if (AREA_ICONS[k]) return AREA_ICONS[k];
  const tk = toolIconKey(k);
  return (tk && AREA_ICONS[tk]) || FALLBACK_ICON;
}

export function Glyph({ entry, size, color }) {
  if (entry.brand) {
    const brand = BRAND_ICONS[entry.brand] || BRAND_ICONS[BRAND_KEY_FOR[entry.brand]];
    if (brand?.path) {
      const s = Math.round(size);
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityLabel={entry.label}>
          <Path d={brand.path} fill={color} />
        </Svg>
      );
    }
  }
  const C = entry.family === M ? MaterialCommunityIcons : Ionicons;
  return <C name={entry.glyph} size={entry.family === M ? Math.round(size * 1.08) : size} color={color} />;
}

/** iOS Settings tile for any area/tool key. Never renders letter text. */
export function AppIconTile({ k, size = 30, style }) {
  const e = iconFor(k);
  const r = Math.round(size * 0.235);
  const glyphColor = '#FFFFFF';
  return (
    <View accessibilityLabel={e.label} style={[{ width: size, height: size, borderRadius: r, backgroundColor: e.color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      shadowColor: e.color, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: size * 0.5, backgroundColor: 'rgba(255,255,255,0.17)' }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.32)' }]} />
      <Glyph entry={e} size={Math.round(size * (e.brand ? 0.55 : 0.58))} color={glyphColor} />
    </View>
  );
}

/** File path -> registry key by extension (Word/Excel/PowerPoint/PDF/image/archive/code). */
export function fileIconKey(p) {
  const ext = String(p || '').toLowerCase().split('.').pop();
  const m = { docx: 'word', doc: 'word', xlsx: 'excel', xls: 'excel', csv: 'csv', pptx: 'powerpoint', ppt: 'powerpoint', pdf: 'pdf',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', zip: 'zip', js: 'coding', ts: 'coding', py: 'coding', json: 'coding', html: 'coding', css: 'coding', md: 'office', txt: 'office' };
  return m[ext] || 'files';
}
