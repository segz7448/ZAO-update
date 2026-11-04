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
  subscription: { glyph: 'card', family: I, color: '#AF52DE', label: 'Subscription' },
  connectors: { glyph: 'extension-puzzle', family: I, color: '#007AFF', label: 'Connectors' },
  vpn: { glyph: 'shield', family: I, color: '#30D158', label: 'VPN' },
  vault: { glyph: 'lock-closed', family: I, color: '#FF9F0A', label: 'Vault' },
  permissions: { glyph: 'shield-checkmark', family: I, color: '#5856D6', label: 'Permissions' },
  activity: { glyph: 'pulse', family: I, color: '#0A84FF', label: 'Activity' },
  appearance_auto: { glyph: 'contrast', family: I, color: '#5856D6', label: 'Auto' },
  appearance_light: { glyph: 'sunny', family: I, color: '#FF9500', label: 'Light' },
  appearance_dark: { glyph: 'moon', family: I, color: '#8E8E93', label: 'Dark' },
  account: { glyph: 'person', family: I, color: '#8E8E93', label: 'Account' },
  remember: { glyph: 'sparkles', family: I, color: '#AF52DE', label: 'Remember' },
  messages: { glyph: 'chatbubbles', family: I, color: '#007AFF', label: 'Messages' },
  tool_calls: { glyph: 'construct', family: I, color: '#5856D6', label: 'Tool calls' },
  openrouter_credits: { brand: 'openrouter', color: '#94A3B8', label: 'OpenRouter' },

  // Vault item types — glyphs only, never letters
  vault_login: { glyph: 'globe', family: I, color: '#007AFF', label: 'Login' },
  vault_api_key: { glyph: 'key', family: I, color: '#FF9500', label: 'API key' },
  vault_secure_note: { glyph: 'document-text', family: I, color: '#AF52DE', label: 'Secure note' },
  vault_ssh_key: { glyph: 'ssh', family: M, color: '#3A3A3C', label: 'SSH key' },
  vault_connector_token: { glyph: 'link', family: I, color: '#0A84FF', label: 'Connector token' },
  vault_totp: { glyph: 'timer', family: I, color: '#FF2D55', label: 'One-time code' },

  // Connectors — brand SVG marks (see brandIcons.js)
  conn_github: { brand: 'github', color: '#181717', label: 'GitHub' },
  conn_gitlab: { brand: 'gitlab', color: '#FC6D26', label: 'GitLab' },
  conn_bitbucket: { brand: 'bitbucket', color: '#0052CC', label: 'Bitbucket' },
  conn_cloudflare: { brand: 'cloudflare', color: '#F38020', label: 'Cloudflare' },
  conn_vercel: { brand: 'vercel', color: '#000000', label: 'Vercel' },
  conn_netlify: { brand: 'netlify', color: '#00C7B7', label: 'Netlify' },
  conn_supabase: { brand: 'supabase', color: '#3FCF8E', label: 'Supabase' },
  conn_firebase: { brand: 'firebase', color: '#DD2C00', label: 'Firebase' },
  conn_googlecloud: { brand: 'googlecloud', color: '#4285F4', label: 'Google Cloud' },
  conn_docker: { brand: 'docker', color: '#2496ED', label: 'Docker' },
  conn_sentry: { brand: 'sentry', color: '#362D59', label: 'Sentry' },
  conn_linear: { brand: 'linear', color: '#5E6AD2', label: 'Linear' },
  conn_jira: { brand: 'jira', color: '#0052CC', label: 'Jira' },
  conn_figma: { brand: 'figma', color: '#F24E1E', label: 'Figma' },
  conn_google: { brand: 'google', color: '#FFFFFF', label: 'Google' },
  conn_gmail: { brand: 'gmail', color: '#EA4335', label: 'Gmail' },
  conn_discord: { brand: 'discord', color: '#5865F2', label: 'Discord' },
  conn_telegram: { brand: 'telegram', color: '#26A5E4', label: 'Telegram' },
  conn_whatsapp: { brand: 'whatsapp', color: '#25D366', label: 'WhatsApp' },
  conn_zoom: { brand: 'zoom', color: '#0B5CFF', label: 'Zoom' },
  conn_google_drive: { brand: 'google_drive', color: '#4285F4', label: 'Google Drive' },
  conn_dropbox: { brand: 'dropbox', color: '#0061FF', label: 'Dropbox' },
  conn_box: { brand: 'box', color: '#0061D5', label: 'Box' },
  conn_notion: { brand: 'notion', color: '#000000', label: 'Notion' },
  conn_googledocs: { brand: 'googledocs', color: '#4285F4', label: 'Google Docs' },
  conn_googlesheets: { brand: 'googlesheets', color: '#34A853', label: 'Google Sheets' },
  conn_airtable: { brand: 'airtable', color: '#18BFFF', label: 'Airtable' },
  conn_confluence: { brand: 'confluence', color: '#172B4D', label: 'Confluence' },
  conn_evernote: { brand: 'evernote', color: '#00A82D', label: 'Evernote' },
  conn_shopify: { brand: 'shopify', color: '#7AB55C', label: 'Shopify' },
  conn_stripe: { brand: 'stripe', color: '#635BFF', label: 'Stripe' },
  conn_paypal: { brand: 'paypal', color: '#002991', label: 'PayPal' },
  conn_square: { brand: 'square', color: '#3E4348', label: 'Square' },
  conn_woocommerce: { brand: 'woocommerce', color: '#873EFF', label: 'Woo' },
  conn_gumroad: { brand: 'gumroad', color: '#FF90E8', label: 'Gumroad' },
  conn_google_calendar: { brand: 'google_calendar', color: '#4285F4', label: 'Google Calendar' },
  conn_todoist: { brand: 'todoist', color: '#E44332', label: 'Todoist' },
  conn_asana: { brand: 'asana', color: '#F06A6A', label: 'Asana' },
  conn_trello: { brand: 'trello', color: '#0052CC', label: 'Trello' },
  conn_clickup: { brand: 'clickup', color: '#7B68EE', label: 'ClickUp' },
  conn_calendly: { brand: 'calendly', color: '#006BFF', label: 'Calendly' },
  conn_x: { brand: 'x', color: '#000000', label: 'X' },
  conn_youtube: { brand: 'youtube', color: '#FF0000', label: 'YouTube' },
  conn_instagram: { brand: 'instagram', color: '#FF0069', label: 'Instagram' },
  conn_tiktok: { brand: 'tiktok', color: '#000000', label: 'TikTok' },
  conn_facebook: { brand: 'facebook', color: '#0866FF', label: 'Facebook' },
  conn_reddit: { brand: 'reddit', color: '#FF4500', label: 'Reddit' },
  conn_pinterest: { brand: 'pinterest', color: '#BD081C', label: 'Pinterest' },
  conn_spotify: { brand: 'spotify', color: '#1ED760', label: 'Spotify' },
  conn_anthropic: { brand: 'anthropic', color: '#191919', label: 'Anthropic' },
  conn_huggingface: { brand: 'huggingface', color: '#FFD21E', label: 'Hugging Face' },
  conn_openrouter: { brand: 'openrouter', color: '#94A3B8', label: 'OpenRouter' },
  conn_postgresql: { brand: 'postgresql', color: '#4169E1', label: 'PostgreSQL' },
  conn_mongodb: { brand: 'mongodb', color: '#47A248', label: 'MongoDB' },
  conn_redis: { brand: 'redis', color: '#FF4438', label: 'Redis' },
  conn_outlook: { brand: 'outlook', color: '#0078D4', label: 'Outlook' },
  conn_onedrive: { brand: 'onedrive', color: '#0078D4', label: 'OneDrive' },
  conn_azure: { brand: 'azure', color: '#0078D4', label: 'Microsoft Azure' },
  conn_teams: { brand: 'teams', color: '#6264A7', label: 'Microsoft Teams' },
  conn_outlook_calendar: { brand: 'outlook_calendar', color: '#0078D4', label: 'Outlook Calendar' },
  conn_slack: { brand: 'slack', color: '#4A154B', label: 'Slack' },
  conn_linkedin: { brand: 'linkedin', color: '#0A66C2', label: 'LinkedIn' },
  conn_openai: { brand: 'openai', color: '#412991', label: 'OpenAI' },
  conn_amazonaws: { brand: 'amazonaws', color: '#FF9900', label: 'AWS' },
  conn_monday: { brand: 'monday', color: '#FF3D57', label: 'monday.com' },
  conn_whop: { brand: 'whop', color: '#FF5A00', label: 'Whop' },

  // Vault add types
  vault_authenticator: { glyph: 'timer', family: I, color: '#FF2D55', label: 'Authenticator' },
  vault_wifi: { glyph: 'wifi', family: I, color: '#007AFF', label: 'Wi-Fi' },
  vault_identity: { glyph: 'person', family: I, color: '#5856D6', label: 'Identity' },
  vault_add: { glyph: 'add', family: I, color: '#007AFF', label: 'Add' },

  // Plugins
  plugins: { glyph: 'apps', family: I, color: '#BF5AF2', label: 'Plugins' },
  plugin_code_reviewer: { glyph: 'code-slash', family: I, color: '#5856D6', label: 'Code Reviewer' },
  plugin_daily_briefing: { glyph: 'newspaper', family: I, color: '#0A84FF', label: 'Daily Briefing' },
  plugin_social_post: { glyph: 'share-social', family: I, color: '#FF2D55', label: 'Social Post Writer' },
  plugin_seo_auditor: { glyph: 'search', family: I, color: '#34C759', label: 'SEO Auditor' },
  plugin_bug_triage: { glyph: 'bug', family: I, color: '#FF3B30', label: 'Bug Triage' },
  plugin_meeting_notes: { glyph: 'document-text', family: I, color: '#AF52DE', label: 'Meeting Notes' },
  plugin_research: { glyph: 'library', family: I, color: '#FF9500', label: 'Research Assistant' },
  plugin_shopify: { brand: 'shopify', color: '#96BF48', label: 'Shopify Store Manager' },
  plugin_youtube: { brand: 'youtube', color: '#FF0000', label: 'YouTube Script Writer' },
  plugin_expense: { glyph: 'wallet', family: I, color: '#30D158', label: 'Expense Tracker' },
  plugin_skill_builder: { glyph: 'construct', family: I, color: '#5E5CE6', label: 'Skill Builder' },
  plugin_builder_guide: { glyph: 'map', family: I, color: '#64D2FF', label: 'Plugin Builder Guide' },
  plugin_create: { glyph: 'sparkles', family: I, color: '#BF5AF2', label: 'Create plugin' },
  plugin_install: { glyph: 'download', family: I, color: '#30D158', label: 'Install plugin' },

};

export const FALLBACK_ICON = { glyph: 'cube', family: I, color: '#8E8E93', label: 'Tool', fallback: true };

/** Host / website → brand registry key when known. */
const HOST_BRAND = [
  [/github\.com$/i, 'conn_github'],
  [/gitlab\.com$/i, 'conn_gitlab'],
  [/bitbucket\.org$/i, 'conn_bitbucket'],
  [/cloudflare\.com$/i, 'conn_cloudflare'],
  [/shopify\.com$/i, 'conn_shopify'],
  [/accounts\.google\.com$|google\.com$/i, 'conn_google'],
  [/gmail\.com$|mail\.google\.com$/i, 'conn_gmail'],
  [/drive\.google\.com$|docs\.google\.com$/i, 'conn_google_drive'],
  [/sheets\.google\.com$/i, 'conn_googlesheets'],
  [/outlook\.(com|live\.com|office\.com)$|office365\.com$/i, 'conn_outlook'],
  [/onedrive\.(live\.)?com$|1drv\.ms$/i, 'conn_onedrive'],
  [/dropbox\.com$/i, 'conn_dropbox'],
  [/box\.com$/i, 'conn_box'],
  [/vercel\.com$/i, 'conn_vercel'],
  [/netlify\.com$/i, 'conn_netlify'],
  [/stripe\.com$/i, 'conn_stripe'],
  [/slack\.com$/i, 'conn_slack'],
  [/notion\.(so|com)$/i, 'conn_notion'],
  [/calendar\.google\.com$/i, 'conn_google_calendar'],
  [/linear\.app$/i, 'conn_linear'],
  [/figma\.com$/i, 'conn_figma'],
  [/discord\.com$/i, 'conn_discord'],
  [/telegram\.org$/i, 'conn_telegram'],
  [/whatsapp\.com$/i, 'conn_whatsapp'],
  [/zoom\.us$/i, 'conn_zoom'],
  [/atlassian\.net$/i, 'conn_jira'],
  [/sentry\.io$/i, 'conn_sentry'],
  [/supabase\.com$/i, 'conn_supabase'],
  [/firebase\.google\.com$/i, 'conn_firebase'],
  [/amazon\.com$|aws\.amazon\.com$/i, 'conn_amazonaws'],
  [/azure\.microsoft\.com$/i, 'conn_azure'],
  [/docker\.com$/i, 'conn_docker'],
  [/openai\.com$/i, 'conn_openai'],
  [/anthropic\.com$/i, 'conn_anthropic'],
  [/huggingface\.co$/i, 'conn_huggingface'],
  [/openrouter\.ai$/i, 'conn_openrouter'],
  [/x\.com$|twitter\.com$/i, 'conn_x'],
  [/youtube\.com$/i, 'conn_youtube'],
  [/instagram\.com$/i, 'conn_instagram'],
  [/tiktok\.com$/i, 'conn_tiktok'],
  [/linkedin\.com$/i, 'conn_linkedin'],
  [/facebook\.com$/i, 'conn_facebook'],
  [/reddit\.com$/i, 'conn_reddit'],
  [/pinterest\.com$/i, 'conn_pinterest'],
  [/spotify\.com$/i, 'conn_spotify'],
  [/todoist\.com$/i, 'conn_todoist'],
  [/asana\.com$/i, 'conn_asana'],
  [/trello\.com$/i, 'conn_trello'],
  [/clickup\.com$/i, 'conn_clickup'],
  [/monday\.com$/i, 'conn_monday'],
  [/calendly\.com$/i, 'conn_calendly'],
  [/airtable\.com$/i, 'conn_airtable'],
  [/paypal\.com$/i, 'conn_paypal'],
  [/squareup\.com$|square\.com$/i, 'conn_square'],
  [/woocommerce\.com$/i, 'conn_woocommerce'],
  [/gumroad\.com$/i, 'conn_gumroad'],
  [/whop\.com$/i, 'conn_whop'],
  [/evernote\.com$/i, 'conn_evernote'],
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
    authenticator: 'vault_authenticator',
    wifi: 'vault_wifi',
    identity: 'vault_identity',
  };
  return byType[item?.type] || 'vault';
}


/** Resolve a website/domain string to an icon key (brand SVG or globe). Never letters. */
export function brandIconForWebsite(website) {
  const host = String(website || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
  if (!host) return 'web'; // globe glyph until a domain is entered
  return vaultIconKey({ website: host, type: 'login' });
}

/** Tool name -> registry key (specific first, then prefix families). */
export function toolIconKey(tool) {
  const t = String(tool || '');
  const exact = { docx_create: 'word', xlsx_create: 'excel', pptx_create: 'powerpoint', csv_create: 'csv', web_search: 'search', web_fetch: 'web',
    data_analyze_file: 'data', time_get_current: 'time', todo_write: 'todo', pc_run_tests: 'test', pc_log_decision: 'decision', pc_read_decisions: 'decision',
    dev_preview_screenshot: 'preview', phone_clipboard_copy: 'clipboard', phone_share_file: 'share',
    plugin_create: 'plugin_create', plugin_install: 'plugin_install', pc_fs_zip: 'zip', pc_fs_extract_zip: 'zip',
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
    if (brand?.paths?.length) {
      const s = Math.round(size);
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityLabel={entry.label}>
          {brand.paths.map((p, i) => (
            <Path key={i} d={p.d} fill={p.fill || color} />
          ))}
        </Svg>
      );
    }
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
