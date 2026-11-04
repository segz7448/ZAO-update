/**
 * ZAO — Theme Tokens (iOS 18 HIG edition of the Muse×Grok blend)
 * Light: iOS system colors, iMessage-style bubbles, grouped backgrounds.
 * Dark: true-black canvas, plain-text assistant (Grok identity kept).
 */

import { Platform } from 'react-native';

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
  sm: 8, md: 10, lg: 13, xl: 18,
  bubble: 18, card: 10, grouped: 10, tile: 7,
  composer: 22, pill: 999, chrome: 18, sheet: 14,
};

export const fontFamily = Platform.select({
  ios: 'System', // SF Pro Text / Display
  android: 'sans-serif',
  default: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
});

/** iOS 18 Dynamic Type (Large / default) */
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: 0.37 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: 0.35 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22, letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21, letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: -0.08 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0 },
  micro: { fontSize: 11, fontWeight: '600', lineHeight: 13, letterSpacing: 0.07 },
};

/** iOS Settings icon-tile palette */
export const tileColors = {
  blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30',
  purple: '#AF52DE', pink: '#FF2D55', teal: '#5AC8FA', indigo: '#5856D6',
  gray: '#8E8E93', yellow: '#FFCC00',
};

export const springs = {
  drawer: { damping: 26, stiffness: 260, mass: 1 },
  sheet: { damping: 24, stiffness: 240, mass: 1 },
  press: { damping: 18, stiffness: 400, mass: 0.6 },
};

export const lightTheme = {
  mode: 'light',
  background: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F7',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  composer: '#FFFFFF',
  composerBorder: 'rgba(60,60,67,0.18)',
  border: 'rgba(60,60,67,0.29)',
  separator: 'rgba(60,60,67,0.29)',
  borderStrong: '#C6C6C8',
  fill: 'rgba(120,120,128,0.12)',
  barTint: 'rgba(249,249,249,0.82)',
  blurTint: 'light',

  textPrimary: '#000000',
  textSecondary: 'rgba(60,60,67,0.6)',
  textTertiary: 'rgba(60,60,67,0.3)',
  textInverse: '#FFFFFF',

  accent: '#007AFF',
  accentSoft: 'rgba(0,122,255,0.1)',
  brand: '#007AFF',
  brandStrong: '#007AFF',
  deny: 'rgba(120,120,128,0.12)',
  chromeButton: 'rgba(120,120,128,0.12)',

  bubbleUser: '#007AFF',
  bubbleAssistant: '#E9E9EB',
  bubbleUserText: '#FFFFFF',
  bubbleAssistantText: '#000000',
  assistantUsesBubble: true,

  speak: '#007AFF',
  speakText: '#FFFFFF',
  sendDisabled: '#C7C7CC',
  citationCard: '#FFFFFF',
  chipBlue: 'rgba(0,122,255,0.1)',
  chipGrey: '#F2F2F7',
  modeSelected: '#FFFFFF',
  modeTrack: 'rgba(118,118,128,0.12)',
  switchTrack: '#34C759',

  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  dangerSoft: 'rgba(255,59,48,0.1)',
  dangerBorder: 'rgba(255,59,48,0.3)',
  dangerText: '#FF3B30',

  info: '#007AFF',
  infoSoft: 'rgba(0,122,255,0.1)',

  overlay: 'rgba(0,0,0,0.4)',
  statusBarStyle: 'dark-content',

  spacing, radii, typography, fontFamily, tileColors,
};

export const darkTheme = {
  mode: 'dark',
  background: '#000000',
  groupedBackground: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  secondarySystemBackground: '#1C1C1E',
  tertiarySystemBackground: '#2C2C2E',
  surfaceElevated: '#1C1C1E',
  composer: '#1C1C1E',
  composerBorder: 'rgba(84,84,88,0.65)',
  border: 'rgba(84,84,88,0.65)',
  separator: 'rgba(84,84,88,0.65)',
  borderStrong: '#38383A',
  fill: 'rgba(120,120,128,0.24)',
  barTint: 'rgba(22,22,24,0.82)',
  blurTint: 'dark',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.6)',
  textTertiary: 'rgba(235,235,245,0.3)',
  textInverse: '#000000',

  accent: '#0A84FF',
  accentSoft: 'rgba(10,132,255,0.18)',
  brand: '#0A84FF',
  brandStrong: '#0A84FF',
  deny: 'rgba(120,120,128,0.24)',
  chromeButton: 'rgba(120,120,128,0.24)',

  bubbleUser: '#0A84FF',
  bubbleAssistant: 'transparent',
  bubbleUserText: '#FFFFFF',
  bubbleAssistantText: '#FFFFFF',
  /** Dark mode keeps the plain-text assistant identity */
  assistantUsesBubble: false,

  speak: '#0A84FF',
  speakText: '#FFFFFF',
  sendDisabled: '#3A3A3C',
  citationCard: '#1C1C1E',
  chipBlue: 'rgba(10,132,255,0.18)',
  chipGrey: '#1C1C1E',
  modeSelected: '#636366',
  modeTrack: 'rgba(118,118,128,0.24)',
  switchTrack: '#30D158',

  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  dangerSoft: 'rgba(255,69,58,0.15)',
  dangerBorder: 'rgba(255,69,58,0.35)',
  dangerText: '#FF453A',

  info: '#0A84FF',
  infoSoft: 'rgba(10,132,255,0.18)',

  overlay: 'rgba(0,0,0,0.6)',
  statusBarStyle: 'light-content',

  spacing, radii, typography, fontFamily, tileColors,
};

export function getTheme(mode) {
  return mode === 'dark' ? darkTheme : lightTheme;
}
