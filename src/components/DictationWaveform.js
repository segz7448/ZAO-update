import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, AccessibilityInfo } from 'react-native';

/**
 * Live vertical-bar waveform for composer dictation.
 * `levels` is an array of 0..1 amplitudes (from dictationMachine.pushLevel).
 * Respects reduce-motion: bars stay at a calm mid height when enabled.
 */
export default function DictationWaveform({ levels = [], color = '#8E8E93', height = 28, style }) {
  const anims = useRef(
    Array.from({ length: Math.max(levels.length, 24) }, () => new Animated.Value(0.2))
  ).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => {
      if (alive) reduceMotion.current = !!v;
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
      reduceMotion.current = !!v;
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    const n = Math.min(anims.length, levels.length || anims.length);
    for (let i = 0; i < n; i++) {
      const target = reduceMotion.current ? 0.35 : Math.max(0.12, Math.min(1, levels[i] ?? 0.2));
      Animated.timing(anims[i], {
        toValue: target,
        duration: reduceMotion.current ? 0 : 70,
        useNativeDriver: false,
      }).start();
    }
  }, [levels, anims]);

  const count = Math.min(anims.length, levels.length || 28);
  return (
    <View style={[styles.row, { height }, style]} accessibilityLabel="Voice level">
      {anims.slice(0, count).map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: a.interpolate({ inputRange: [0, 1], outputRange: [3, height] }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
    minHeight: 3,
  },
});
