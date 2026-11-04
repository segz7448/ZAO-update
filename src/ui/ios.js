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

/** Solid chrome bar (no glass). Bars sit on opaque barTint. */
export function FrostedBar({ theme, style, children, intensity = 80 }) {
  return <View style={[style, { backgroundColor: theme.barTint }]}>{children}</View>;
}

export function Grabber({ theme }) {
  return <View style={[styles.grabber, { backgroundColor: theme.mode === 'dark' ? '#5A5A5E' : '#C7C7CC' }]} />;
}

const AMBIENT_LIGHT = require('../../assets/ui/ambient-light.png');
const AMBIENT_DARK = require('../../assets/ui/ambient-dark.png');

/**
 * Solid card fill (legacy name GlassFill kept for call sites).
 * Frosted BlurView is reserved for IconGlassFill / icon tiles only.
 */
export function GlassFill({ theme, radius = 16, strong = false, intensity, shapeStyle }) {
  const fill = theme.card || theme.glassFill || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundColor: fill }, shapeStyle];
  return <View pointerEvents="none" style={shape} />;
}

/** Frosted glass fill — ONLY for AppIconTile / icon chrome. */
export function IconGlassFill({ theme, radius = 16, intensity = 40, shapeStyle }) {
  const fill = theme.iconGlass || (theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)');
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, shapeStyle];
  if (Platform.OS === 'ios') {
    return (
      <BlurView pointerEvents="none" tint={theme.blurTint} intensity={intensity} style={shape}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      </BlurView>
    );
  }
  return <View pointerEvents="none" style={[shape, { backgroundColor: fill }]} />;
}

/** Solid opaque card surface (no translucent glass). Soft hairline + light shadow. */
export function glassSurface(theme, radius = 16) {
  return {
    backgroundColor: theme.card || theme.glassFill || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF'),
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.separator || theme.glassHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.06,
    elevation: 1,
    overflow: 'hidden',
  };
}

/** Solid canvas — no orb gradient (gradients were read as glass/translucent). */
export function AmbientBackground({ theme }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.ambientBase || theme.background }]} />
  );
}

const ORB = require('../../assets/ui/zao-orb.png');
const ALLOW_GRADIENT = require('../../assets/ui/allow-gradient.png');

/** Prefer Ionicons' thin outline variant when one exists (Muse/Grok Bot outline glyphs). */
export function outlineName(name) {
  if (!name || name.endsWith('-outline')) return name;
  const candidate = `${name}-outline`;
  return Ionicons.glyphMap && Ionicons.glyphMap[candidate] ? candidate : name;
}

/** iOS Settings-style rounded-square colored icon tile (v1, kept in the mix build). */
export function IconTile({ name, color, size = 29 }) {
  return (
    <View style={[styles.tile, { backgroundColor: color, width: size, height: size }]}>
      <Ionicons name={name} size={Math.round(size * 0.62)} color="#FFFFFF" />
    </View>
  );
}

/** Muse/Grok 44pt soft circle — filled white (dark #2C2C2E), soft shadow, no outline. */
export function CircleButton({ theme, icon, onPress, size = 44, label, iconSize = 22, style, children }) {
  const fill = theme.chromeButton || (theme.mode === 'dark' ? '#2C2C2E' : '#FFFFFF');
  return (
    <TouchableOpacity
      onPress={() => { haptic.light(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          shadowOpacity: theme.mode === 'dark' ? 0.45 : 0.12,
          elevation: 3,
        },
        style,
      ]}
    >
      {children || <Ionicons name={outlineName(icon)} size={iconSize} color={theme.chromeIcon} />}
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
  tile: { borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  circle: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },
  pillBtn: { flex: 1, height: 44, borderRadius: 999, overflow: 'hidden' },
  pillFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  pillText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
