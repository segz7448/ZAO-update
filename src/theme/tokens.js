/**
 * ZAO — Theme Tokens (v2: Grok Bot iOS primary, Muse iOS + xAI Grok iOS secondary)
 * Light: Grok Bot #F7F7F7 canvas, white 16pt cards, black user / #F1F2F1 bot bubbles.
 * Dark: Muse #0A0A0A canvas, #272727 sheets, #474747 sheet cards; Grok plain-text assistant.
 * See /workspace/zao-ios-v2-notes.md for the source of every value.
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
  bubble: 18, card: 16, grouped: 16, tile: 7,
  composer: 22, pill: 999, chrome: 22, sheet: 14,
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

/** Grok Bot layout metrics (01-bot-profile, measured @3x) */
export const layout = {
  circleButton: 44,   // back / share / more white circles
  cardInset: 24,      // 24pt side inset -> 345pt card on a 393pt phone
  rowHeight: 50,
  rowIconColumn: 56,  // divider inset to text column
  listAvatar: 40,     // home/sidebar list avatars
};

/** Muse Allow gradient (appstore-02, measured) */
export const allowGradient = ['#0762D5', '#155FDA', '#3159DF', '#4156E5'];

export const springs = {
  drawer: { damping: 26, stiffness: 260, mass: 1 },
  sheet: { damping: 24, stiffness: 240, mass: 1 },
  press: { damping: 18, stiffness: 400, mass: 0.6 },
};

export const lightTheme = {
  mode: 'light',
  background: '#FCFCFC',          // Grok Bot home/chat
  groupedBackground: '#F7F7F7',   // Grok Bot profile canvas
  surface: '#FFFFFF',
  surfaceAlt: '#F7F7F7',
  secondarySystemBackground: '#F7F7F7',
  tertiarySystemBackground: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  composer: '#FFFFFF',
  composerBorder: 'rgba(0,0,0,0.06)',
  border: '#EDEDED',
  separator: '#F3F3F3',           // Grok Bot row divider
  borderStrong: '#E7E7E8',
  fill: '#EFEFF0',
  barTint: 'rgba(252,252,252,0.86)',
  blurTint: 'light',
  // Glass pass: translucent fills over the ambient orb background (BlurView on iOS).
  glassFill: 'rgba(255,255,255,0.55)',
  glassFillStrong: 'rgba(255,255,255,0.72)',
  glassFillAndroid: 'rgba(255,255,255,0.82)', // no live blur on Android: denser fill keeps AA contrast
  glassHighlight: 'rgba(255,255,255,0.6)',
  glassShadowOpacity: 0.10,
  glassBlurIntensity: 40,
  glassSelected: 'rgba(255,255,255,0.85)',
  userBubbleGlass: 'rgba(11,11,11,0.86)',
  userBubbleHighlight: 'rgba(255,255,255,0.18)',
  ambientBase: '#F2F4FA',

  textPrimary: '#000000',
  textSecondary: '#636366',       // darkened for WCAG AA on glass (≈5.2:1)
  textTertiary: '#76767B',        // Grok Bot helper text
  textInverse: '#FFFFFF',
  chevron: '#A7A7AA',
  timestamp: '#BABABA',
  icon: '#8A8A8D',

  accent: '#0762D5',              // Muse Allow start
  accentSoft: 'rgba(7,98,213,0.10)',
  brand: '#0762D5',
  brandStrong: '#0762D5',
  deny: '#F3F4F6',                // Muse Deny
  denyText: '#111111',
  chromeButton: '#FFFFFF',        // 44pt white circles
  chromeIcon: '#000000',
  pill: '#E7E7E8',                // Grok Bot Edit pill
  headerPill: '#FFFFFF',

  bubbleUser: '#0B0B0B',          // Grok Bot user bubble
  bubbleAssistant: '#F1F2F1',     // Grok Bot bot bubble
  bubbleUserText: '#FFFFFF',
  bubbleAssistantText: '#000000',
  assistantUsesBubble: true,

  speak: '#0B0B0B',
  speakText: '#FFFFFF',
  sendDisabled: '#C7C7CC',
  citationCard: '#F1F2F1',
  chipBlue: 'rgba(7,98,213,0.10)',
  chipGrey: '#F1F2F1',
  modeSelected: '#FFFFFF',
  modeTrack: '#EFEFF0',
  switchTrack: '#34C759',         // mix: iOS system green switches app-wide

  success: '#1FA855',
  successSoft: 'rgba(31,168,85,0.12)',
  warning: '#E08600',
  warningSoft: 'rgba(224,134,0,0.12)',
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.10)',
  dangerBorder: 'rgba(229,72,77,0.30)',
  dangerText: '#D93036',

  info: '#0762D5',
  infoSoft: 'rgba(7,98,213,0.10)',

  overlay: 'rgba(0,0,0,0.30)',
  statusBarStyle: 'dark-content',

  spacing, radii, typography, fontFamily, tileColors, layout,
};

export const darkTheme = {
  mode: 'dark',
  background: '#0A0A0A',          // Muse dark canvas
  groupedBackground: '#0A0A0A',
  surface: '#1C1C1C',
  surfaceAlt: '#272727',
  secondarySystemBackground: '#272727', // Muse sheet
  tertiarySystemBackground: '#474747',  // Muse sheet card
  surfaceElevated: '#272727',
  composer: '#1A1A1A',            // Grok composer fill
  composerBorder: 'rgba(255,255,255,0.06)',
  border: '#2A2A2A',
  separator: 'rgba(255,255,255,0.08)',
  borderStrong: '#3C3B3B',
  fill: '#262626',
  barTint: 'rgba(10,10,10,0.86)',
  blurTint: 'dark',
  glassFill: 'rgba(28,28,30,0.5)',
  glassFillStrong: 'rgba(28,28,30,0.68)',
  glassFillAndroid: 'rgba(28,28,30,0.84)',
  glassHighlight: 'rgba(255,255,255,0.12)',
  glassShadowOpacity: 0.35,
  glassBlurIntensity: 50,
  glassSelected: 'rgba(255,255,255,0.14)',
  userBubbleGlass: 'rgba(48,48,52,0.82)',
  userBubbleHighlight: 'rgba(255,255,255,0.14)',
  ambientBase: '#08080C',

  textPrimary: '#FFFFFF',
  textSecondary: '#9A9A9E',
  textTertiary: '#6A6A6E',
  textInverse: '#000000',
  chevron: '#6A6A6E',
  timestamp: '#6A6A6E',
  icon: '#B0B0B4',

  accent: '#2B88D3',              // Muse dark link blue
  accentSoft: 'rgba(43,136,211,0.18)',
  brand: '#2B88D3',
  brandStrong: '#2B88D3',
  deny: '#2D2D2D',
  denyText: '#FFFFFF',
  chromeButton: '#1C1C1C',
  chromeIcon: '#FFFFFF',
  pill: '#2D2D2D',                // Grok Ask pill
  headerPill: '#1C1C1C',

  bubbleUser: '#262626',          // Grok dark user bubble
  bubbleAssistant: 'transparent',
  bubbleUserText: '#FFFFFF',
  bubbleAssistantText: '#FFFFFF',
  /** Glass pass: frosted assistant bubbles in dark too (was Grok plain text) */
  assistantUsesBubble: true,

  speak: '#FFFFFF',               // Grok Speak/send: white in dark
  speakText: '#000000',
  sendDisabled: '#3A3A3C',
  citationCard: '#1C1C1C',
  chipBlue: 'rgba(43,136,211,0.18)',
  chipGrey: '#1C1C1C',
  modeSelected: '#3A3A3A',
  modeTrack: '#1A1A1A',
  switchTrack: '#30D158',

  success: '#30D158',
  successSoft: 'rgba(48,209,88,0.18)',
  warning: '#FF9F0A',
  warningSoft: 'rgba(255,159,10,0.18)',
  danger: '#FF453A',
  dangerSoft: 'rgba(255,69,58,0.15)',
  dangerBorder: 'rgba(255,69,58,0.35)',
  dangerText: '#FF453A',

  info: '#23C8FF',                // Muse progress
  infoSoft: 'rgba(35,200,255,0.15)',

  overlay: 'rgba(0,0,0,0.60)',
  statusBarStyle: 'light-content',

  spacing, radii, typography, fontFamily, tileColors, layout,
};

export function getTheme(mode) {
  return mode === 'dark' ? darkTheme : lightTheme;
}
