/**
 * ZAO - Inline chat Browser Card (replaces the old floating BrowserAgentPiP
 * mini window). Lives in the message list at the point the browser task
 * started; shows the real streamed frames, a live status pill, the current
 * action, and controls wired to EXISTING BrowserAgentStream actions only:
 *   Expand   -> App's full browserAgent screen (same stream, no new socket)
 *   Take over-> opens fullscreen in manual control (page taps -> manualClick,
 *               keyboard -> manualType/manualKey); its Done chip hands back
 *               via stream.resumeAfterHuman() when the agent was waiting
 *   Stop     -> stream.cancel()             ({type:'cancel'})
 * No Pause/Resume controls: the server protocol has no pause message, and
 * resuming happens from fullscreen's Done.
 * State comes from browserCardStore (fed by the stream - no polling).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassFill, glassSurface, haptic } from '../ui/ios';
import { CARD_PHASE, statusPill, domainFromUrl } from '../services/browserAgent/browserCardState';

const STREAM_W = 412; // server/browserAgent.js viewport
const STREAM_H = 915;

function toneColor(theme, tone) {
  switch (tone) {
    case 'success': return theme.success;
    case 'warning': return theme.warning;
    case 'danger': return theme.danger;
    case 'neutral': return theme.textSecondary;
    case 'live': return theme.danger;
    default: return theme.brand;
  }
}

export function PulseDot({ color, pulse, size = 7 }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) { v.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, v]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v }} />;
}

export function StatusPill({ theme, phase }) {
  const p = statusPill(phase);
  const c = toneColor(theme, p.tone);
  return (
    <View style={[styles.pill, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.75)', borderColor: theme.glassHighlight }]} accessibilityLabel={`Status: ${p.label}`}>
      {p.tone === 'success' ? <Ionicons name="checkmark-circle" size={12} color={c} /> : <PulseDot color={c} pulse={p.pulse} />}
      <Text style={[styles.pillText, { color: theme.textPrimary }]}>{p.label}</Text>
    </View>
  );
}

function Ctl({ theme, icon, label, onPress, tone, primary, iconOnly }) {
  const color = tone === 'danger' ? theme.danger : primary ? '#FFFFFF' : theme.textPrimary;
  return (
    <TouchableOpacity
      onPress={() => { haptic.light(); onPress?.(); }}
      style={[styles.ctl, primary ? { backgroundColor: theme.brand, borderColor: 'transparent' } : { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.7)', borderColor: theme.glassHighlight }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={color} />
      {iconOnly ? null : <Text style={[styles.ctlText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

export default function BrowserCard({ card, theme, stream, onExpand, onTakeOver, onToggleCollapsed, onStopRequested, onLayout }) {
  const { phase, title, url, caption, lastFrame, collapsed } = card;
  const domain = domainFromUrl(url);
  const live = phase === CARD_PHASE.WORKING || phase === CARD_PHASE.PAUSED || phase === CARD_PHASE.LIVE || phase === CARD_PHASE.RECONNECTING;
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current !== phase) {
      if (phase === CARD_PHASE.DONE) haptic.success();
      else if (phase === CARD_PHASE.PAUSED || phase === CARD_PHASE.ERROR) haptic.warning();
      prevPhase.current = phase;
    }
  }, [phase]);
  const [vw, setVw] = React.useState(0);
  const heading = title || domain || 'Browser';

  const header = (
    <View style={styles.header}>
      <View style={[styles.globe, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.8)', borderColor: theme.glassHighlight }]}>
        <Ionicons name="globe-outline" size={17} color={theme.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.kicker, { color: theme.textSecondary }]} numberOfLines={1}>BROWSER{domain ? ` · ${domain}` : ''}</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>{collapsed ? (live ? caption : heading) : heading}</Text>
      </View>
      <StatusPill theme={theme} phase={phase} />
      <TouchableOpacity onPress={() => { haptic.select(); onToggleCollapsed?.(); }} hitSlop={10} accessibilityLabel={collapsed ? 'Expand browser card' : 'Minimize browser card'} style={styles.chev}>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.wrap, glassSurface(theme, 20)]} onLayout={onLayout}>
      <GlassFill theme={theme} radius={20} strong />
      {header}
      {!collapsed && (
        <>
          <TouchableOpacity activeOpacity={0.9} onPress={() => { haptic.light(); onExpand?.(); }} accessibilityLabel="Open the browser fullscreen"
            style={[styles.viewport, { backgroundColor: theme.mode === 'dark' ? '#000' : '#E9EAF0', borderColor: theme.glassHighlight }]}
            onLayout={(e) => setVw(e.nativeEvent.layout.width)}>
            {lastFrame ? (
              <Image source={{ uri: `data:image/jpeg;base64,${lastFrame}` }} style={{ width: vw, height: vw * (STREAM_H / STREAM_W) }} resizeMode="cover" />
            ) : (
              <View style={styles.empty}>
                {phase === CARD_PHASE.ERROR ? <Ionicons name="alert-circle-outline" size={26} color={theme.danger} /> : <ActivityIndicator color={theme.textSecondary} />}
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{phase === CARD_PHASE.ERROR ? 'No preview available' : 'Waiting for the live view…'}</Text>
              </View>
            )}
            {phase === CARD_PHASE.RECONNECTING && (
              <View style={styles.veil}><ActivityIndicator color="#fff" /><Text style={styles.veilText}>Reconnecting…</Text></View>
            )}
            <View style={styles.expandBadge}><Ionicons name="expand" size={14} color="#fff" /></View>
          </TouchableOpacity>
          <View style={styles.captionRow}>
            <Ionicons name={phase === CARD_PHASE.DONE ? 'checkmark-done' : phase === CARD_PHASE.ERROR ? 'alert-circle' : 'navigate-circle-outline'} size={16} color={phase === CARD_PHASE.ERROR ? theme.danger : theme.textSecondary} />
            <Text style={[styles.caption, { color: theme.textPrimary }]} numberOfLines={2}>{caption}</Text>
          </View>
          <View style={styles.ctls}>
            <Ctl theme={theme} icon="expand-outline" label="Expand" iconOnly onPress={onExpand} />
            {(phase === CARD_PHASE.WORKING || phase === CARD_PHASE.PAUSED) && (
              <Ctl theme={theme} icon="hand-left-outline" label="Take over" primary={phase === CARD_PHASE.PAUSED} onPress={() => (onTakeOver || onExpand)?.()} />
            )}
            {(phase === CARD_PHASE.WORKING || phase === CARD_PHASE.PAUSED) && (
              <Ctl theme={theme} icon="stop-circle-outline" label="Stop" tone="danger" onPress={() => { haptic.warning(); if (stream?.cancel()) onStopRequested?.(); }} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

/** Slim floating indicator shown while the live card is scrolled out of view. */
export function BrowserMiniIndicator({ card, theme, onPress }) {
  return (
    <TouchableOpacity onPress={() => { haptic.light(); onPress?.(); }} style={[styles.mini, glassSurface(theme, 999)]} accessibilityLabel="Jump to the live browser card">
      <GlassFill theme={theme} radius={999} strong />
      {card.lastFrame ? <Image source={{ uri: `data:image/jpeg;base64,${card.lastFrame}` }} style={styles.miniThumb} /> : <Ionicons name="globe-outline" size={16} color={theme.brand} />}
      <Text style={[styles.miniText, { color: theme.textPrimary }]} numberOfLines={1}>{card.caption}</Text>
      <StatusPill theme={theme} phase={card.phase} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginVertical: 8, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  globe: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  chev: { padding: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },
  viewport: { width: '100%', aspectRatio: 16 / 10, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13 },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  veilText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  expandBadge: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  caption: { flex: 1, fontSize: 14, fontWeight: '500' },
  ctls: { flexDirection: 'row', gap: 6 },
  ctl: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1 },
  ctlText: { fontSize: 14, fontWeight: '600' },
  mini: { position: 'absolute', top: 6, alignSelf: 'center', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 6, height: 38, zIndex: 20 },
  miniThumb: { width: 26, height: 26, borderRadius: 13 },
  miniText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
