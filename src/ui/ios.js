/**
 * iOS UI helpers (visual only): haptics, frosted bars, grabber, icon tiles.
 * Haptics are fire-and-forget and never throw into callers.
 */
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

/** iOS Settings-style rounded-square colored icon tile */
export function IconTile({ name, color, size = 29 }) {
  return (
    <View style={[styles.tile, { backgroundColor: color, width: size, height: size }]}>
      <Ionicons name={name} size={Math.round(size * 0.62)} color="#FFFFFF" />
    </View>
  );
}

export function Hairline({ theme, inset = 0 }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  grabber: { width: 36, height: 5, borderRadius: 2.5, alignSelf: 'center', marginTop: 6, marginBottom: 8 },
  tile: { borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
