/**
 * ZAO - small animated building blocks shared by BrowserCard and
 * BrowserFullscreen (RN Animated only; no new deps). All honour the OS
 * reduce-motion setting.
 *   useReduceMotion()  - live AccessibilityInfo flag
 *   LiveLight          - status dot with an expanding halo while pulsing
 *   ProgressRing       - spinning partial ring (the "working" status icon)
 *   FadeSwapText       - cross-fades/slides text when the value changes
 *   ShimmerBar         - thin indeterminate progress sweep
 *   GlassLayer         - frosted fill + specular top highlight
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

export function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setRm(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setRm(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return rm;
}

function useLoop(active, build, deps) {
  useEffect(() => {
    if (!active) return undefined;
    const loop = build();
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

export function LiveLight({ color, pulse, size = 8 }) {
  const rm = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useLoop(pulse && !rm, () => { v.setValue(0); return Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true })); }, [v]);
  const halo = size * 2.6;
  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
      {pulse && !rm ? (
        <Animated.View style={{ position: 'absolute', width: halo, height: halo, borderRadius: halo / 2, backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }} />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
    </View>
  );
}

export function ProgressRing({ size = 20, color = '#fff', track = 'rgba(255,255,255,0.22)', stroke = 2.5 }) {
  const rm = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useLoop(!rm, () => { v.setValue(0); return Animated.loop(Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })); }, [v]);
  const ring = { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke };
  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Working">
      <View style={[ring, { borderColor: track }]} />
      <Animated.View style={[ring, { borderColor: 'transparent', borderTopColor: color, borderRightColor: color,
        transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
    </View>
  );
}

export function FadeSwapText({ text, style, numberOfLines = 1 }) {
  const rm = useReduceMotion();
  const [shown, setShown] = useState(text);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (text === shown) return;
    if (rm) { setShown(text); return; }
    Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setShown(text);
      Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }, [text, shown, rm, v]);
  return (
    <Animated.Text numberOfLines={numberOfLines} style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
      {shown}
    </Animated.Text>
  );
}

export function ShimmerBar({ active, color = '#0A84FF', height = 2 }) {
  const rm = useReduceMotion();
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  useLoop(active && !rm && w > 0, () => { v.setValue(0); return Animated.loop(Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true })); }, [v, w]);
  if (!active) return <View style={{ height }} />;
  return (
    <View style={{ height, overflow: 'hidden', borderRadius: height, backgroundColor: 'rgba(255,255,255,0.08)' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={{ width: rm ? '100%' : w * 0.35, height, borderRadius: height, backgroundColor: color, opacity: rm ? 0.6 : 1,
        shadowColor: color, shadowOpacity: 1, shadowRadius: 6,
        transform: rm ? [] : [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.35, w] }) }] }} />
    </View>
  );
}

/** Dark frosted glass with a specular top-edge highlight. Put inside a view with overflow hidden + radius. */
export function GlassLayer({ radius = 24, intensity = 55, tint = 'rgba(30,30,34,0.62)' }) {
  return (
    <>
      {Platform.OS === 'ios' ? <BlurView tint="dark" intensity={intensity} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} /> : null}
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: Platform.OS === 'ios' ? tint : 'rgba(36,36,40,0.94)' }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', borderTopColor: 'rgba(255,255,255,0.38)' }]} />
    </>
  );
}

export const glassShadow = { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 };
