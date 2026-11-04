/**
 * ZAO - where-the-agent-acts overlay for the live browser frame.
 *
 * Driven only by real stream data: `target` is the card's lastTarget (the
 * server's step.target, see services/browserAgent/clickTarget.js). Draws,
 * scaled to how the frame is displayed:
 *   - a glass cursor dot that glides to each new target
 *   - a brief outline box around the element
 *   - a soft blue glow ring that pulses on clicks and fades out (~1.2s)
 * Reduce motion: no glide/pulse, the dot jumps and outline/ring just fade.
 * Callers hide it during takeover. pointerEvents="none" so taps pass through.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { mapTargetToView, isRingAction, ringSize } from '../services/browserAgent/clickTarget';
import { useReduceMotion } from './browserFx';

const BLUE = '#0A84FF';
const DOT = 18;
const RING_MS = 1200;
const IDLE_HIDE_MS = 4000; // cursor fades if no new target for a while

/**
 * @param {object} props
 * @param {object|null} props.target  - card.lastTarget ({ x,y,w,h,vw,vh, action, n })
 * @param {boolean} [props.visible]   - false during takeover / when there's no frame
 * @param {object}  [props.fit]       - clickTarget.frameBox options: { mode, align, zoom }
 * @param {boolean} [props.compact]   - smaller dot/ring for the card
 */
export default function ClickRingOverlay({ target, visible = true, fit, compact = false }) {
  const rm = useReduceMotion();
  const [size, setSize] = useState(null);
  const [rect, setRect] = useState(null);
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dotO = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current; // 0 -> 1 per pulse
  const outline = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const idle = useRef(null);
  const [ringOn, setRingOn] = useState(false);
  const scaleK = compact ? 0.7 : 1;

  const key = target ? `${target.n}:${target.at}` : null;
  useEffect(() => {
    if (!visible || !size || !target) return undefined;
    const r = mapTargetToView(target, size.w, size.h, fit);
    setRect(r);
    if (!r) return undefined;
    const to = { x: r.cx - (DOT * scaleK) / 2, y: r.cy - (DOT * scaleK) / 2 };
    if (rm || !placed.current) pos.setValue(to);
    else Animated.spring(pos, { toValue: to, friction: 9, tension: 60, useNativeDriver: true }).start();
    placed.current = true;
    Animated.timing(dotO, { toValue: 1, duration: rm ? 0 : 180, useNativeDriver: true }).start();

    outline.setValue(1);
    Animated.timing(outline, { toValue: 0, duration: rm ? 700 : 1100, delay: rm ? 300 : 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

    const doRing = isRingAction(target);
    setRingOn(doRing);
    if (doRing) {
      ring.setValue(0);
      Animated.timing(ring, { toValue: 1, duration: RING_MS, delay: rm ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(() => Animated.timing(dotO, { toValue: 0, duration: 400, useNativeDriver: true }).start(), IDLE_HIDE_MS);
    return () => clearTimeout(idle.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible, size?.w, size?.h, fit?.mode, fit?.align, fit?.zoom, rm]);

  if (!visible) return null;
  const rs = ringSize(rect) * scaleK;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => { const { width: w, height: h } = e.nativeEvent.layout; if (w > 0 && h > 0) setSize({ w, h }); }}>
      {rect ? (
        <>
          <Animated.View style={[styles.outline, { left: rect.x - 3, top: rect.y - 3, width: rect.w + 6, height: rect.h + 6, opacity: outline }]} />
          {ringOn ? (
            <Animated.View style={[styles.ring, {
              left: rect.cx - rs / 2, top: rect.cy - rs / 2, width: rs, height: rs, borderRadius: rs / 2,
              opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
              transform: [{ scale: rm ? 1 : ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.45] }) }],
            }]} />
          ) : null}
        </>
      ) : null}
      <Animated.View style={[styles.dot, { width: DOT * scaleK, height: DOT * scaleK, borderRadius: (DOT * scaleK) / 2, opacity: rect ? dotO : 0, transform: pos.getTranslateTransform() }]}>
        <View style={styles.dotCore} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outline: { position: 'absolute', borderRadius: 8, borderWidth: 2, borderColor: 'rgba(10,132,255,0.9)', backgroundColor: 'rgba(10,132,255,0.08)' },
  ring: { position: 'absolute', borderWidth: 3, borderColor: BLUE, backgroundColor: 'rgba(10,132,255,0.18)', shadowColor: BLUE, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  dot: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  dotCore: { width: '42%', height: '42%', borderRadius: 99, backgroundColor: BLUE },
});
