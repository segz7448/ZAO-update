/**
 * ZAO - trackpad-mode touch surface + pointer for takeover.
 * Gesture logic lives in services/browserAgent/trackpad.js (pure, tested);
 * this only feeds it touches and sends its commands down the stream using
 * the manualMouseMove/Down/Up, manualClick(count) and manualWheel messages.
 * Moves are coalesced to ~30/s; presses flush the pending move first.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { initialTrackpad, trackpadReduce, createMoveThrottle, pageToView, TP } from '../services/browserAgent/trackpad';
import { haptic } from '../ui/ios';
import { useReduceMotion } from './browserFx';

let lastPointer = null; // survives toggling trackpad off/on within the app session

const centroid = (e) => {
  const ts = e.nativeEvent.touches || [];
  if (!ts.length) return { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, n: 0 };
  let x = 0, y = 0; for (const t of ts) { x += t.pageX; y += t.pageY; }
  return { x: x / ts.length, y: y / ts.length, n: ts.length };
};

/**
 * @param {object} props
 * @param {object} props.stream - BrowserAgentStream (manualMouse*, manualClick, manualWheel)
 * @param {number} props.viewW / props.viewH - measured size of the stream view
 * @param {number} [props.zoom]
 */
export default function TrackpadLayer({ stream, viewW, viewH, zoom = 1 }) {
  const rm = useReduceMotion();
  const fit = { mode: 'contain', align: 'center', zoom };
  const scaleRef = useRef(1);
  const stRef = useRef(initialTrackpad(lastPointer));
  const [pointer, setPointer] = useState(stRef.current.pointer);
  const [pressed, setPressed] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const throttle = useRef(createMoveThrottle(TP.MOVE_HZ)).current;
  const longTimer = useRef(null);
  const nRef = useRef(0); // active finger count
  const flushTimer = useRef(null);
  const streamRef = useRef(stream); streamRef.current = stream;
  const rmRef = useRef(rm); rmRef.current = rm;

  const view = pageToView(pointer, viewW, viewH, fit);
  // view px per page px, same contain+zoom fit as the frame
  scaleRef.current = viewW > 0 && viewH > 0 ? Math.min(viewW / 412, viewH / 915) * (zoom > 0 ? zoom : 1) : 1;

  const send = (c) => {
    const s = streamRef.current; if (!s) return;
    if (c.type === 'move') s.manualMouseMove?.(c.x, c.y);
    else if (c.type === 'down') s.manualMouseDown?.(c.x, c.y);
    else if (c.type === 'up') s.manualMouseUp?.(c.x, c.y);
    else if (c.type === 'click') s.manualClick?.(c.x, c.y, c.count);
    else if (c.type === 'wheel') s.manualWheel?.(c.dx, c.dy, c.x, c.y);
  };
  const dispatch = (ev) => {
    const { state, cmds } = trackpadReduce(stRef.current, ev, { scale: scaleRef.current });
    stRef.current = state; lastPointer = state.pointer;
    for (const c of cmds) {
      if (c.type === 'move') {
        const now = Date.now(); const out = throttle.push(c, now);
        if (out) send(out);
        else { clearTimeout(flushTimer.current); flushTimer.current = setTimeout(() => { const p = throttle.flush(Date.now()); if (p) send(p); }, 1000 / TP.MOVE_HZ); }
        continue;
      }
      const p = throttle.flush(Date.now()); if (p) send(p);
      send(c);
      if (c.type === 'click' || c.type === 'down') {
        haptic.light();
        if (!rmRef.current) { pulse.setValue(0.75); Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }).start(); }
      }
      if (c.type === 'down') setPressed(true);
      if (c.type === 'up') setPressed(false);
    }
    setPointer(state.pointer);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const c = centroid(e); nRef.current = c.n || 1;
      dispatch({ type: 'start', t: Date.now(), x: c.x, y: c.y, touches: c.n || 1 });
      clearTimeout(longTimer.current);
      longTimer.current = setTimeout(() => dispatch({ type: 'longPress', t: Date.now() }), TP.LONG_MS);
    },
    onPanResponderMove: (e) => {
      const c = centroid(e);
      if (c.n !== nRef.current) { // finger count changed: re-anchor so the centroid jump isn't a move
        const was = nRef.current; nRef.current = c.n;
        if (was) { dispatch({ type: 'rebase', t: Date.now(), x: c.x, y: c.y }); return; }
      }
      if (stRef.current.moved > TP.TAP_SLOP || c.n >= 2) clearTimeout(longTimer.current);
      dispatch({ type: 'move', t: Date.now(), x: c.x, y: c.y, touches: c.n });
    },
    onPanResponderRelease: () => { clearTimeout(longTimer.current); dispatch({ type: 'end', t: Date.now(), touches: 0 }); },
    onPanResponderTerminate: () => { clearTimeout(longTimer.current); dispatch({ type: 'end', t: Date.now(), touches: 0 }); },
  })).current;

  useEffect(() => () => {
    clearTimeout(longTimer.current); clearTimeout(flushTimer.current);
    if (stRef.current.mode === 'drag') send({ type: 'up', ...stRef.current.pointer }); // never leave the button held
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers} accessibilityLabel="Trackpad. Drag to move the pointer, tap to click, two fingers to scroll">
      {view ? (
        <Animated.View pointerEvents="none" style={[styles.pointer, { left: view.x - 3, top: view.y - 2, transform: [{ scale: pulse }] }]}>
          {/* white arrow with a dark rim, tip at (left+3, top+2) */}
          <MaterialCommunityIcons name="cursor-default" size={30} color={pressed ? '#0A84FF' : '#fff'} style={styles.abs} />
          <MaterialCommunityIcons name="cursor-default-outline" size={30} color="#1C1C1E" style={styles.abs} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: { position: 'absolute', width: 30, height: 30, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  abs: { position: 'absolute', left: -6, top: -3 },
});
