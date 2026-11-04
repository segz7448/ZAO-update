/**
 * ZAO - Plan UI primitives (visual only): iOS-Settings-style area tiles,
 * SF-Symbols-style status glyphs, a real fraction progress ring (no SVG -
 * two clipped half-ring rotations), and a running-row shimmer. One icon
 * family: Ionicons iOS glyphs; MDI only for xmark.octagon (Ionicons has none).
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useReduceMotion, ProgressRing } from './browserFx';

import { AppIconTile, iconFor } from '../ui/icons';

/** Area tile (central registry, src/ui/icons.js). */
export function AreaTile({ domain, size = 30 }) { return <AppIconTile k={domain || 'planning'} size={size} />; }
export const areaLabel = (d) => iconFor(d || 'planning').label;

/** Status colors per theme (iOS system palette). */
export function statusColor(theme, status) {
  const dark = theme.mode === 'dark';
  return {
    done: dark ? '#30D158' : '#34C759', completed: dark ? '#30D158' : '#34C759', reached: dark ? '#30D158' : '#34C759',
    failed: dark ? '#FF453A' : '#FF3B30', cancelled: theme.textTertiary, missed: dark ? '#FF453A' : '#FF3B30',
    awaiting_approval: dark ? '#FF9F0A' : '#FF9500', paused: dark ? '#FF9F0A' : '#FF9500',
    running: dark ? '#0A84FF' : '#007AFF', recovering: dark ? '#0A84FF' : '#007AFF', planning: dark ? '#0A84FF' : '#007AFF', in_progress: dark ? '#0A84FF' : '#007AFF',
    blocked: theme.textTertiary, skipped: theme.textTertiary, pending: theme.textTertiary,
  }[status] || theme.textTertiary;
}

/** SF-style status glyph: checkmark.circle.fill / xmark.octagon / spinner / exclamationmark.triangle / lock / pause. */
export function StatusGlyph({ status, theme, size = 22, animateIn = false }) {
  const c = statusColor(theme, status);
  const rm = useReduceMotion();
  const pop = useRef(new Animated.Value(animateIn && !rm ? 0 : 1)).current;
  useEffect(() => {
    if (!animateIn || rm) { pop.setValue(1); return; }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [animateIn, status, rm, pop]);
  let glyph;
  switch (status) {
    case 'done': case 'completed': case 'reached':
      glyph = <Ionicons name="checkmark-circle-outline" size={size} color={c} />; break;
    case 'failed': case 'missed':
      glyph = <Ionicons name="close-circle-outline" size={size} color={c} />; break;
    case 'running': case 'recovering': case 'in_progress': case 'planning':
      glyph = <PulsingSpinner size={size} color={c} />; break;
    case 'awaiting_approval': glyph = <Ionicons name="warning-outline" size={size} color={c} />; break;
    case 'blocked': glyph = <Ionicons name="lock-closed-outline" size={size - 2} color={c} />; break;
    case 'paused': glyph = <Ionicons name="pause-circle-outline" size={size} color={c} />; break;
    case 'skipped': case 'cancelled': glyph = <Ionicons name="remove-circle-outline" size={size} color={c} />; break;
    default: glyph = <Ionicons name="ellipse-outline" size={size} color={c} />; break;
  }
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
      {glyph}
    </Animated.View>
  );
}

/** Spinner that pulses opacity while a step is running (respects reduce-motion). */
function PulsingSpinner({ size, color }) {
  const rm = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (rm) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [rm, pulse]);
  return (
    <Animated.View style={{ opacity: rm ? 1 : pulse, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <ProgressRing size={size - 4} color={color} track={`${color}33`} stroke={2.2} />
    </Animated.View>
  );
}

/** Fraction ring (0..1), animated to its value; snaps under reduce-motion. */
export function ArcRing({ fraction = 0, size = 44, stroke = 4, color = '#007AFF', track = 'rgba(120,120,128,0.2)', children }) {
  const rm = useReduceMotion();
  const v = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    if (rm) { v.setValue(fraction); return; }
    Animated.timing(v, { toValue: fraction, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fraction, rm, v]);
  const half = size / 2;
  const ring = { position: 'absolute', top: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: 'transparent', borderTopColor: color, borderRightColor: color };
  // a top+right ring's arc spans -45..135deg; rotating by deg-135 makes it span [deg-180, deg],
  // so the right clip shows 0..min(deg,180) and the left clip 180..max(deg,180)
  const rotR = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-135deg', '45deg', '45deg'] });
  const rotL = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['45deg', '45deg', '225deg'] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: track }} />
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: -half, transform: [{ rotate: rotR }] }]} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: 0, opacity: v.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [0, 0, 1, 1] }), transform: [{ rotate: rotL }] }]} />
      </View>
      {children}
    </View>
  );
}

/** Soft light sweep across a running row; static tint under reduce-motion. */
export function RowShimmer({ color = '#007AFF', radius = 18 }) {
  const rm = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rm) return undefined;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [rm, v]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundColor: `${color}0F` }]}>
      {rm ? null : <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 120, backgroundColor: `${color}22`,
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-140, 420] }) }, { skewX: '-18deg' }] }} />}
    </View>
  );
}

/** Small capsule label (risk, counts). */
export function Capsule({ icon, label, color, theme, filled = false }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11,
      backgroundColor: filled ? color : `${color}1F`, borderWidth: StyleSheet.hairlineWidth, borderColor: `${color}55` }}>
      {icon ? <Ionicons name={icon} size={12} color={filled ? '#fff' : color} /> : null}
      <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: -0.1, color: filled ? '#fff' : color }}>{label}</Text>
    </View>
  );
}

export const PLAN_STATUS_LABEL = {
  planning: 'Planning', running: 'Running', awaiting_approval: 'Needs you', paused: 'Paused',
  recovering: 'Recovering', completed: 'Done', failed: 'Failed', cancelled: 'Cancelled',
};
