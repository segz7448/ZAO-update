/**
 * ZAO — Theme Tokens
 *
 * Original Muse×Grok-inspired system (not a copy of either app).
 * Light: Muse-like soft canvas + bubbles. Dark: Grok-like true-black canvas.
 * Spacing / radii / typography are first-class tokens (previously ad-hoc).
 *
 * Chosen unknowns (noted for the redesign report):
 * - Dark Muse palette unavailable → dark mode follows Grok-like #000 / #1A1A1A
 * - Brand accent → Muse icon blue #0073F4 (light) / #4B9BFF (dark); Allow #225CDD
 * - Mode switcher labels → Chat | Plan | Browse (maps to existing ZAO surfaces)
 * - Trailing composer CTA → Send (no voice feature; Speak-style pill shape only)
 * - Type scale → 13/15/17/26 system sans; 4pt spacing grid; bubble radius 20
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  bubble: 20,
  card: 16,
  composer: 24,
  pill: 999,
  chrome: 20,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '600', lineHeight: 32 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  callout: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 17 },
  micro: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
};

export const lightTheme = {
  mode: 'light',
  background: '#FDFDFD',
  surface: '#FFFFFF',
  surfaceAlt: '#EAEAEC',
  surfaceElevated: '#FFFFFF',
  composer: '#EAEAEC',
  border: '#EAEAEC',
  borderStrong: '#D8D8DC',

  textPrimary: '#111111',
  textSecondary: '#6B6B70',
  textTertiary: '#9A9AA0',
  textInverse: '#FFFFFF',

  accent: '#111111',
  accentSoft: '#F3F5F7',
  brand: '#0073F4',
  brandStrong: '#225CDD',
  deny: '#F3F5F7',
  chromeButton: '#F9F9F9',

  bubbleUser: '#CCE5FF',
  bubbleAssistant: '#EAEAEC',
  bubbleUserText: '#111111',
  bubbleAssistantText: '#111111',
  /** Light mode keeps Muse-like soft assistant bubbles */
  assistantUsesBubble: true,

  speak: '#000000',
  speakText: '#FFFFFF',
  citationCard: '#FFFFFF',
  chipBlue: '#F2F5FE',
  chipGrey: '#F9F9F9',
  modeSelected: '#EAEAEC',
  modeTrack: '#F3F5F7',

  success: '#22C55E',
  warning: '#EAB308',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  info: '#0073F4',
  infoSoft: '#E8F2FF',

  overlay: 'rgba(0,0,0,0.35)',
  statusBarStyle: 'dark-content',

  spacing,
  radii,
  typography,
};

export const darkTheme = {
  mode: 'dark',
  background: '#000000',
  surface: '#1A1A1A',
  surfaceAlt: '#262626',
  surfaceElevated: '#1A1A1A',
  composer: '#1A1A1A',
  border: '#2A2A2A',
  borderStrong: '#3A3A3A',

  textPrimary: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textTertiary: '#737373',
  textInverse: '#000000',

  accent: '#FAFAFA',
  accentSoft: '#262626',
  brand: '#4B9BFF',
  brandStrong: '#225CDD',
  deny: '#262626',
  chromeButton: '#0A0A0A',

  bubbleUser: '#171717',
  bubbleAssistant: 'transparent',
  bubbleUserText: '#FAFAFA',
  bubbleAssistantText: '#FAFAFA',
  /** Dark mode: Grok-like plain assistant text on canvas */
  assistantUsesBubble: false,

  speak: '#FFFFFF',
  speakText: '#000000',
  citationCard: '#1E1E1E',
  chipBlue: '#1A2332',
  chipGrey: '#1A1A1A',
  modeSelected: '#2D2D2D',
  modeTrack: '#0A0A0A',

  success: '#4ADE80',
  warning: '#FACC15',
  danger: '#F87171',
  dangerSoft: '#2A1616',
  dangerBorder: '#4A2323',
  dangerText: '#F87171',

  info: '#60A5FA',
  infoSoft: '#1A2332',

  overlay: 'rgba(0,0,0,0.65)',
  statusBarStyle: 'light-content',

  spacing,
  radii,
  typography,
};

export function getTheme(mode) {
  return mode === 'dark' ? darkTheme : lightTheme;
}
