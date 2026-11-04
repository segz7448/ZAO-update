/**
 * iOS UI helpers (visual only): haptics, frosted bars, grabber, icon tiles.
 * Haptics are fire-and-forget and never throw into callers.
 */
import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

export const haptic = {
  light: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  select: () => { Haptics.selectionAsync().catch(() => {}); },
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};

/** Frosted translucent bar; falls back to the semi-transparent barTint. */
export function FrostedBar({ theme, style, children, intensity = 80 }) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView tint={theme.blurTint} intensity={intensity} style={style}>
        {children}
      </BlurView>
    );
  }
  return <View style={[style, { backgroundColor: theme.barTint }]}>{children}</View>;
}

export function Grabber({ theme }) {
  return <View style={[styles.grabber, { backgroundColor: theme.mode === 'dark' ? '#5A5A5E' : '#C7C7CC' }]} />;
}

const ORB = require('../../assets/ui/zao-orb.png');
const ALLOW_GRADIENT = require('../../assets/ui/allow-gradient.png');

/** Prefer Ionicons' thin outline variant when one exists (Muse/Grok Bot outline glyphs). */
export function outlineName(name) {
  if (!name || name.endsWith('-outline')) return name;
  const candidate = `${name}-outline`;
  return Ionicons.glyphMap && Ionicons.glyphMap[candidate] ? candidate : name;
}

/**
 * Leading row icon. v2: Grok Bot uses thin gray outline glyphs, no colored tile.
 * `color` is accepted for API compatibility but ignored unless `tinted`.
 */
export function IconTile({ name, color, size = 29, theme, tinted = false }) {
  const iconColor = tinted ? color : (theme?.icon || '#8A8A8D');
  return (
    <View style={[styles.tile, { width: size, height: size }]}>
      <Ionicons name={outlineName(name)} size={Math.round(size * 0.76)} color={iconColor} />
    </View>
  );
}

/** Grok Bot 44pt white circular header button with soft shadow. */
export function CircleButton({ theme, icon, onPress, size = 44, label, iconSize = 22, style, children }) {
  return (
    <TouchableOpacity
      onPress={() => { haptic.light(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.circle, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: theme.chromeButton,
        shadowOpacity: theme.mode === 'dark' ? 0 : 0.08,
      }, style]}
    >
      {children || <Ionicons name={icon} size={iconSize} color={theme.chromeIcon} />}
    </TouchableOpacity>
  );
}

/** ZAO's own avatar: a box-generated blue orb (no third-party character art). */
export function ZaoAvatar({ size = 40, style }) {
  return <Image source={ORB} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/** Muse-style gradient Allow pill (#0762D5 -> #4156E5). */
export function AllowButton({ label = 'Allow', onPress, disabled, style, textStyle, icon }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.pillBtn, disabled && { opacity: 0.5 }, style]} accessibilityRole="button">
      <ImageBackground source={ALLOW_GRADIENT} resizeMode="stretch" style={styles.pillFill} imageStyle={{ borderRadius: 999 }}>
        {icon ? <Ionicons name={icon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} /> : null}
        <Text style={[styles.pillText, { color: '#FFFFFF' }, textStyle]}>{label}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );
}

/** Muse Deny pill (#F3F4F6, dark text). */
export function DenyButton({ theme, label = 'Deny', onPress, disabled, style, textStyle }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.pillBtn, { backgroundColor: theme.deny }, disabled && { opacity: 0.5 }, style]} accessibilityRole="button">
      <View style={styles.pillFill}>
        <Text style={[styles.pillText, { color: theme.denyText }, textStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function Hairline({ theme, inset = 0 }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  grabber: { width: 36, height: 5, borderRadius: 2.5, alignSelf: 'center', marginTop: 6, marginBottom: 8 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  circle: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },
  pillBtn: { flex: 1, height: 44, borderRadius: 999, overflow: 'hidden' },
  pillFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  pillText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
