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
import { CARD_PHASE, statusPill, domainFromUrl, phaseLight } from '../services/browserAgent/browserCardState';
import ClickRingOverlay from './ClickRingOverlay';
import { LiveLight, ProgressRing, FadeSwapText, GlassLayer, glassShadow } from './browserFx';

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
  const l = phaseLight(phase);
  const tinted = phase === CARD_PHASE.PAUSED || phase === CARD_PHASE.DONE || phase === CARD_PHASE.ERROR || phase === CARD_PHASE.WORKING;
  return (
    <View style={[styles.pill, { backgroundColor: tinted ? `${l.color}2E` : 'rgba(255,255,255,0.10)', borderColor: tinted ? `${l.color}66` : 'rgba(255,255,255,0.16)' }]} accessibilityLabel={`Status: ${p.label}`}>
      {phase === CARD_PHASE.DONE ? <Ionicons name="checkmark-circle" size={14} color={l.color} /> : <LiveLight color={l.color} pulse={l.pulse} size={7} />}
      <Text style={[styles.pillText, { color: tinted ? l.color : '#fff' }]}>{p.label}</Text>
    </View>
  );
}

/** Big iOS pill button (44pt). kind: glass | primary | alert | danger; iconOnly renders a 44pt circle. */
function Ctl({ icon, label, onPress, kind = 'glass', iconOnly }) {
  const fg = kind === 'alert' ? '#1C1C1E' : '#FFFFFF';
  const bg = kind === 'primary' ? '#0A84FF' : kind === 'alert' ? '#FFD60A' : kind === 'danger' ? '#FF453A' : null;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => { kind === 'danger' ? haptic.warning() : haptic.medium(); onPress?.(); }}
      style={[styles.ctl, iconOnly && styles.ctlRound, bg ? { backgroundColor: bg, shadowColor: bg, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } } : null, !iconOnly && { flex: 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {bg ? null : <GlassLayer radius={22} tint="rgba(255,255,255,0.10)" />}
      <Ionicons name={icon} size={18} color={fg} />
      {iconOnly ? null : <Text style={[styles.ctlText, { color: fg }]} numberOfLines={1}>{label}</Text>}
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
      <View style={styles.globe}>
        <Ionicons name="globe-outline" size={19} color="#4FA3FF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.kicker]} numberOfLines={1}>BROWSER{domain ? ` · ${domain}` : ''}</Text>
        <Text style={[styles.title]} numberOfLines={1}>{collapsed ? (live ? caption : heading) : heading}</Text>
      </View>
      <StatusPill theme={theme} phase={phase} />
      <TouchableOpacity onPress={() => { haptic.select(); onToggleCollapsed?.(); }} hitSlop={10} accessibilityLabel={collapsed ? 'Expand browser card' : 'Minimize browser card'} style={styles.chev}>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.wrap, glassShadow]} onLayout={onLayout}>
      <GlassLayer radius={26} intensity={60} />
      {header}
      {!collapsed && (
        <>
          <TouchableOpacity activeOpacity={0.9} onPress={() => { haptic.light(); onExpand?.(); }} accessibilityLabel="Open the browser fullscreen"
            style={[styles.viewport, phase === CARD_PHASE.PAUSED && styles.viewportAlert]}
            onLayout={(e) => setVw(e.nativeEvent.layout.width)}>
            {lastFrame ? (
              <Image source={{ uri: `data:image/jpeg;base64,${lastFrame}` }} style={{ width: vw, height: vw * (STREAM_H / STREAM_W) }} resizeMode="cover" />
            ) : (
              <View style={styles.empty}>
                {phase === CARD_PHASE.ERROR ? <Ionicons name="alert-circle-outline" size={26} color={theme.danger} /> : <ActivityIndicator color={theme.textSecondary} />}
                <Text style={[styles.emptyText, { color: '#8E8E93' }]}>{phase === CARD_PHASE.ERROR ? 'No preview available' : 'Waiting for the live view…'}</Text>
              </View>
            )}
            {/* where the agent is acting (step.target); frame is width-filled + top-aligned = cover/top. Agent phases only - hidden once it's the person's turn. */}
            <ClickRingOverlay compact target={card.lastTarget || null} visible={!!lastFrame && (phase === CARD_PHASE.WORKING || phase === CARD_PHASE.LIVE)} fit={{ mode: 'cover', align: 'top' }} />
            {phase === CARD_PHASE.RECONNECTING && (
              <View style={styles.veil}><ActivityIndicator color="#fff" /><Text style={styles.veilText}>Reconnecting…</Text></View>
            )}
            <View style={styles.expandBadge}><GlassLayer radius={16} /><Ionicons name="expand-outline" size={16} color="#fff" /></View>
          </TouchableOpacity>
          <View style={styles.captionRow}>
            {phase === CARD_PHASE.WORKING ? <ProgressRing size={16} color="#4FA3FF" stroke={2} />
              : phase === CARD_PHASE.PAUSED ? <View style={styles.needBadge}><Ionicons name="hand-left-outline" size={13} color="#FFD60A" /></View>
              : <Ionicons name={phase === CARD_PHASE.DONE ? 'checkmark-done' : phase === CARD_PHASE.ERROR ? 'alert-circle' : 'navigate-circle-outline'} size={17} color={phaseLight(phase).color} />}
            <FadeSwapText text={caption} style={styles.caption} numberOfLines={2} />
          </View>
          <View style={styles.ctls}>
            <Ctl icon="expand-outline" label="Expand" iconOnly onPress={onExpand} />
            {(phase === CARD_PHASE.WORKING || phase === CARD_PHASE.PAUSED) && (
              <Ctl icon="hand-left-outline" label="Take over" kind={phase === CARD_PHASE.PAUSED ? 'primary' : 'glass'} onPress={() => (onTakeOver || onExpand)?.()} />
            )}
            {(phase === CARD_PHASE.WORKING || phase === CARD_PHASE.PAUSED) && (
              <Ctl icon="stop" label="Stop" kind="danger" onPress={() => { if (stream?.cancel()) onStopRequested?.(); }} />
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
  wrap: { marginHorizontal: 12, marginVertical: 8, padding: 14, gap: 12, borderRadius: 26 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  globe: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(79,163,255,0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(79,163,255,0.4)' },
  kicker: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: 'rgba(235,235,245,0.6)' },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4, color: '#fff', marginTop: 1 },
  chev: { padding: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 10, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
  pillText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },
  viewport: { width: '100%', aspectRatio: 16 / 11, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff' },
  viewportAlert: { borderWidth: 2, borderColor: 'rgba(255,214,10,0.8)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F2F2F7' },
  emptyText: { fontSize: 13 },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  veilText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  needBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,214,10,0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,214,10,0.55)' }, // outline glyph in a tinted disc - a filled yellow hand reads as an emoji
  expandBadge: { position: 'absolute', right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  caption: { flex: 1, fontSize: 15, fontWeight: '500', letterSpacing: -0.2, color: 'rgba(255,255,255,0.88)' },
  ctls: { flexDirection: 'row', gap: 8 },
  ctl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, paddingHorizontal: 16, borderRadius: 22, overflow: 'hidden' },
  ctlRound: { width: 44, paddingHorizontal: 0 },
  ctlText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  mini: { position: 'absolute', top: 6, alignSelf: 'center', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 6, height: 38, zIndex: 20 },
  miniThumb: { width: 26, height: 26, borderRadius: 13 },
  miniText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
