/**
 * ZAO - central icon registry. One source of truth for every area / tool
 * glyph in the app: {glyph, family, color, label}. Rendered as iOS
 * Settings-style tiles (colored rounded square, white glyph, gloss) via
 * <AppIconTile/>. Family is Ionicons; MDI only where Ionicons has no
 * matching glyph (Word / Excel / PowerPoint / PDF document marks).
 * Unknown / future keys resolve to a polished neutral fallback tile, so a
 * new tool always gets a real icon, never a text tag.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const I = 'ion'; const M = 'mdi';
export const AREA_ICONS = {
  coding: { glyph: 'code-slash', family: I, color: '#5856D6', label: 'Coding' },
  terminal: { glyph: 'terminal', family: I, color: '#3A3A3C', label: 'Terminal' },
  files: { glyph: 'folder', family: I, color: '#FF9F0A', label: 'Files' },
  filesystem: { glyph: 'folder', family: I, color: '#FF9F0A', label: 'Files' },
  browser: { glyph: 'compass', family: I, color: '#0A84FF', label: 'Browser' },
  github: { glyph: 'logo-github', family: I, color: '#1F2328', label: 'GitHub' },
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
  memory: { glyph: 'bulb', family: I, color: '#FFCC00', label: 'Memory' },
  decision: { glyph: 'bookmark', family: I, color: '#FF9500', label: 'Decision log' },
  agent: { glyph: 'people', family: I, color: '#BF5AF2', label: 'Sub-agents' },
  worktree: { glyph: 'git-network', family: I, color: '#F05033', label: 'Worktree' },
  clipboard: { glyph: 'clipboard', family: I, color: '#8E8E93', label: 'Clipboard' },
  share: { glyph: 'share', family: I, color: '#007AFF', label: 'Share' },
  email: { glyph: 'mail', family: I, color: '#007AFF', label: 'Mail' },
  image: { glyph: 'image', family: I, color: '#FF2D55', label: 'Image' },
  zip: { glyph: 'archive', family: I, color: '#A2845E', label: 'Archive' },
  checkpoint: { glyph: 'flag', family: I, color: '#34C759', label: 'Checkpoint' },
  general: { glyph: 'sparkles', family: I, color: '#636366', label: 'ZAO' },
};
export const FALLBACK_ICON = { glyph: 'cube', family: I, color: '#8E8E93', label: 'Tool', fallback: true };

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
  const C = entry.family === M ? MaterialCommunityIcons : Ionicons;
  return <C name={entry.glyph} size={entry.family === M ? Math.round(size * 1.08) : size} color={color} />;
}

/** iOS Settings tile for any area/tool key. */
export function AppIconTile({ k, size = 30, style }) {
  const e = iconFor(k);
  const r = Math.round(size * 0.235);
  return (
    <View accessibilityLabel={e.label} style={[{ width: size, height: size, borderRadius: r, backgroundColor: e.color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      shadowColor: e.color, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: size * 0.5, backgroundColor: 'rgba(255,255,255,0.17)' }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.32)' }]} />
      <Glyph entry={e} size={Math.round(size * 0.58)} color="#FFFFFF" />
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
