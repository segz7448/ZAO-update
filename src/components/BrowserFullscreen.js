/**
 * ZAO - Browser fullscreen view (the expanded form of the inline chat
 * BrowserCard, and what the chat header's desktop icon opens).
 *
 * Replaces the retired BrowserAgentPiP fullscreen + BrowserAgentScreen
 * chrome pair. It renders the SAME App-owned BrowserAgentStream (no new
 * socket) through BrowserStreamView, with glass iOS chrome on top:
 *   top:    round collapse chevron, site pill (tap to type a URL), [keyboard
 *           button in takeover+trackpad], square
 *           Stop (stream.cancel) while a task runs or waits on you
 *   page:   the live frame in a rounded sheet (tappable during takeover)
 *   bottom: a live status pill streaming the agent's current step, plus a
 *           Take over chip (highlighted when the agent needs a human).
 *           Take over makes the page tappable (manualClick) and turns the
 *           chip into Done, which hands back via resumeAfterHuman when the
 *           agent was waiting. No visible text fields: tapping the page
 *           in takeover focuses a hidden TextInput, so the soft keyboard
 *           types via manualType / manualKey.
 * Tasks always come from the chat.
 * When no task has run yet, BrowserStreamView shows its idle
 * "Connected - waiting for a task" placeholder.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, BackHandler, Animated, Easing, PanResponder, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BrowserStreamView from '../services/browserAgent/BrowserStreamView';
import { haptic } from '../ui/ios';
import { domainFromUrl, phaseLight, iconForAction, formatStepTime } from '../services/browserAgent/browserCardState';
import { LiveLight, ProgressRing, FadeSwapText, ShimmerBar, GlassLayer, glassShadow, useReduceMotion } from './browserFx';
import { useBrowserCardStore } from '../store/browserCardStore';

export default function BrowserFullscreen({
  visible, stream, theme, isRunning = false, awaitingHuman = false, humanReason = null,
  frameBase64 = null, connected = false, connectionError = null, tabs = [], zoom = 1, onClose,
  startInTakeover = false,
}) {
  const insets = useSafeAreaInsets();
  const [takeover, setTakeover] = useState(false); // manual control: page taps are forwarded
  const [kbValue, setKbValue] = useState(''); // hidden keyboard sink (no visible text box)
  const kbRef = useRef(null);
  const [trackpad, setTrackpad] = useState(false); // takeover only: relative pointer instead of direct taps
  const [addressText, setAddressText] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const dispatchCard = useBrowserCardStore((s) => s.dispatch);
  const activeCard = useBrowserCardStore((s) => s.cards.find((c) => c.id === s.activeCardId));

  const activeTab = tabs.find((t) => t.active) || tabs[0] || null;
  const currentUrl = activeTab?.url && activeTab.url !== 'about:blank' ? activeTab.url : '';

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose?.(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  // Opened from the card's Take over, or the agent asked for a human ->
  // enter manual control. Leaving the screen ends it.
  useEffect(() => { if (visible && startInTakeover) setTakeover(true); }, [visible, startInTakeover]);
  useEffect(() => { if (!visible) { setTakeover(false); setKbValue(''); } }, [visible]);

  // Advanced chrome state: step-history sheet, entrance (card -> fullscreen) and takeover glow.
  const rm = useReduceMotion();
  const [historyOpen, setHistoryOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) { enter.setValue(0); setHistoryOpen(false); return; }
    if (rm) { enter.setValue(1); return; }
    Animated.spring(enter, { toValue: 1, damping: 18, stiffness: 180, mass: 0.9, useNativeDriver: true }).start();
  }, [visible, rm, enter]);
  useEffect(() => {
    if (!takeover || rm) { glow.setValue(takeover ? 1 : 0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.45, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [takeover, rm, glow]);
  useEffect(() => {
    Animated.timing(sheet, { toValue: historyOpen ? 1 : 0, duration: rm ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [historyOpen, rm, sheet]);
  // Swipe up on the status pill opens the step history; swipe down closes it.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => { if (g.dy < -24) { haptic.select(); setHistoryOpen(true); } else if (g.dy > 24) setHistoryOpen(false); },
  })).current;

  if (!visible) return null;

  const stop = () => { haptic.warning(); if (stream?.cancel()) dispatchCard({ type: 'stopRequested' }); };
  const submitAddress = () => { if (addressText.trim()) stream?.navigateTo(addressText.trim()); setEditingAddress(false); };
  const hasSession = connected && (isRunning || awaitingHuman || !!activeCard && !['done', 'stopped', 'error'].includes(activeCard.phase));
  const canTakeOver = isRunning || awaitingHuman;
  const startTakeover = () => { haptic.medium(); setTakeover(true); };
  // Done: only send resumeAfterHuman when the agent is actually waiting on
  // a human - sending it mid-run would start a second model loop on the PC.
  const finishTakeover = () => {
    haptic.success();
    kbRef.current?.blur();
    setTakeover(false);
    setTrackpad(false);
    setKbValue('');
    if (awaitingHuman) stream?.resumeAfterHuman();
  };
  // Hidden TextInput -> manualType / manualKey. Diffing the value lets the
  // soft keyboard work without a visible box: additions are typed,
  // deletions become Backspace presses, return becomes Enter.
  const onKbChange = (next) => {
    if (next.length > kbValue.length && next.startsWith(kbValue)) stream?.manualType(next.slice(kbValue.length));
    else if (next.length < kbValue.length) for (let i = 0; i < kbValue.length - next.length; i += 1) stream?.manualKey('Backspace');
    else if (next !== kbValue) stream?.manualType(next);
    setKbValue(next);
  };
  const statusText = !connected
    ? (connectionError ? 'Not connected to the PC' : 'Reconnecting…')
    : takeover ? 'You have control'
    : awaitingHuman ? (humanReason ? `Needs you: ${humanReason}` : 'Needs you to take over')
    : isRunning ? (activeCard?.caption || 'Working on it…')
    : hasSession ? (activeCard?.caption || 'Idle') : 'Waiting for a task from chat';

  const domain = domainFromUrl(currentUrl);
  const active = isRunning || awaitingHuman;
  const phase = awaitingHuman ? 'paused' : isRunning ? 'working' : activeCard?.phase || 'idle';
  const light = !connected ? { color: '#8E8E93', pulse: true } : phaseLight(phase, { takeover });
  const history = activeCard?.history || [];
  const close = () => {
    haptic.light();
    if (rm) { onClose?.(); return; }
    Animated.timing(enter, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onClose?.());
  };
  const enterStyle = {
    opacity: enter,
    transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }, { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={[styles.fill, enterStyle]}>
        {/* top chrome: round collapse chevron · site pill · [keyboard, trackpad mode] · square stop */}
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={close} style={[styles.round, glassShadow]} accessibilityRole="button" accessibilityLabel="Collapse browser" hitSlop={6}>
            <GlassLayer radius={24} /><Ionicons name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { haptic.select(); setAddressText(currentUrl); setEditingAddress(true); }}
            style={[styles.site, glassShadow, editingAddress && { flex: 1 }]}
            accessibilityLabel="Site address"
          >
            <GlassLayer radius={24} />
            <Ionicons name={currentUrl.startsWith('https') ? 'lock-closed' : 'globe-outline'} size={15} color="#4FA3FF" />
            {editingAddress ? (
              <TextInput style={styles.siteInput} value={addressText} onChangeText={setAddressText} onSubmitEditing={submitAddress}
                onBlur={() => setEditingAddress(false)} autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="url"
                placeholder="Enter address" placeholderTextColor="#8E8E93" returnKeyType="go" selectTextOnFocus />
            ) : (
              <Text style={[styles.siteText, { flexShrink: 1 }]} numberOfLines={1}>{domain || 'New tab'}</Text>
            )}
          </TouchableOpacity>
          {takeover && trackpad && !editingAddress ? (
            <TouchableOpacity onPress={() => { haptic.select(); kbRef.current?.focus(); }} style={[styles.round, glassShadow]} accessibilityRole="button" accessibilityLabel="Show keyboard" hitSlop={6}>
              <GlassLayer radius={24} /><MaterialCommunityIcons name="keyboard-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {active ? (
            <TouchableOpacity onPress={stop} style={[styles.round, glassShadow]} accessibilityRole="button" accessibilityLabel="Stop task" hitSlop={6}>
              <GlassLayer radius={24} /><Ionicons name="stop" size={17} color="#fff" />
            </TouchableOpacity>
          ) : <View style={styles.round} />}
        </View>
        {/* indeterminate progress sweep while the agent is acting */}
        <View style={styles.shimmerWrap}><ShimmerBar active={connected && isRunning && !awaitingHuman && !takeover} /></View>

        {/* live page in a rounded sheet; taps are forwarded only in takeover */}
        <View style={styles.pageWrap}>
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow }]} />
          <View style={[styles.page, takeover && styles.pageTakeover]} onTouchEnd={takeover && !trackpad ? () => kbRef.current?.focus() : undefined}>
            <BrowserStreamView frameBase64={frameBase64} stream={stream} interactive={takeover} trackpad={takeover && trackpad} connected={connected} connectionError={connectionError} isRunning={isRunning} zoom={zoom} target={activeCard?.lastTarget || null} />
            {takeover ? (
              <View style={styles.banner} pointerEvents="none">
                <GlassLayer radius={18} />
                <View style={styles.bannerIcon}>{trackpad
                  ? <MaterialCommunityIcons name="cursor-default-click-outline" size={16} color="#fff" />
                  : <Ionicons name="hand-left" size={14} color="#fff" />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>{trackpad ? 'Trackpad mode' : "You're in control"}</Text>
                  <Text style={styles.bannerSub} numberOfLines={2}>{trackpad ? 'Drag to move · tap to click · two fingers to scroll' : 'Tap the page to click · the keyboard types into it'}</Text>
                </View>
              </View>
            ) : awaitingHuman ? (
              <View style={styles.reason} pointerEvents="none">
                <GlassLayer radius={18} />
                <View style={[styles.bannerIcon, { backgroundColor: '#FFD60A' }]}><Ionicons name="hand-left" size={14} color="#1C1C1E" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>The agent needs you</Text>
                  <Text style={styles.bannerSub} numberOfLines={2}>{humanReason || 'Take over to continue.'}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
        {takeover ? (
          <TextInput ref={kbRef} value={kbValue} onChangeText={onKbChange} onSubmitEditing={() => stream?.manualKey('Enter')} blurOnSubmit={false}
            autoCapitalize="none" autoCorrect={false} caretHidden style={styles.kbSink} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}

        {/* bottom: big glass status pill (tap / swipe up for step history) + Take over / Done pill */}
        <View style={[styles.bottomRow, { marginBottom: Math.max(12, insets.bottom) }]}>
          {takeover ? (
            <TouchableOpacity onPress={() => { haptic.select(); kbRef.current?.blur(); setTrackpad((t) => !t); }}
              style={[styles.tpToggle, trackpad ? styles.tpOn : glassShadow]} accessibilityRole="switch" accessibilityState={{ checked: trackpad }}
              accessibilityLabel="Trackpad mode" hitSlop={4}>
              {trackpad ? null : <GlassLayer radius={30} />}
              <MaterialCommunityIcons name="cursor-default-click-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <Pressable {...pan.panHandlers} onPress={() => { if (history.length) { haptic.select(); setHistoryOpen((o) => !o); } }}
            style={[styles.bar, glassShadow]} accessibilityRole="button" accessibilityLabel={`${statusText}. Show recent steps`}>
            <GlassLayer radius={30} />
            {connected && isRunning && !awaitingHuman && !takeover ? <ProgressRing size={20} color="#fff" /> : <LiveLight color={light.color} pulse={light.pulse} size={9} />}
            <FadeSwapText text={statusText} style={styles.workingText} />
            {/* chevron hidden in takeover so 'You have control' fits beside the trackpad toggle + Done */}
            {history.length && !takeover ? <Ionicons name={historyOpen ? 'chevron-down' : 'chevron-up'} size={16} color="rgba(255,255,255,0.55)" /> : null}
          </Pressable>
          {takeover ? (
            <TouchableOpacity onPress={finishTakeover} style={[styles.chip, styles.chipPrimary]} accessibilityRole="button" accessibilityLabel="Done - hand control back">
              <Ionicons name="checkmark" size={19} color="#fff" /><Text style={styles.chipText}>Done</Text>
            </TouchableOpacity>
          ) : canTakeOver ? (
            <TouchableOpacity onPress={startTakeover} style={[styles.chip, glassShadow, awaitingHuman && styles.chipAlert]} accessibilityRole="button" accessibilityLabel="Take over the browser">
              {awaitingHuman ? null : <GlassLayer radius={30} />}
              <Ionicons name="hand-left-outline" size={18} color={awaitingHuman ? '#1C1C1E' : '#fff'} />
              <Text style={[styles.chipText, awaitingHuman && { color: '#1C1C1E' }]}>Take over</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* step history sheet: the card's real step messages, newest first */}
      {historyOpen ? <Pressable style={styles.scrim} onPress={() => setHistoryOpen(false)} accessibilityLabel="Close step history" /> : null}
      <Animated.View pointerEvents={historyOpen ? 'auto' : 'none'}
        style={[styles.sheet, glassShadow, { bottom: Math.max(12, insets.bottom) + 70, opacity: sheet, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
        <GlassLayer radius={26} intensity={70} />
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Steps</Text>
          <Text style={styles.sheetCount}>{history.length}</Text>
        </View>
        <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingBottom: 8 }}>
          {[...history].reverse().map((h, i) => (
            <View key={`${h.n}-${h.at}-${i}`} style={styles.stepRow}>
              <View style={[styles.stepIcon, i === 0 && active && { backgroundColor: 'rgba(10,132,255,0.25)' }]}>
                <Ionicons name={iconForAction(h.action)} size={15} color={i === 0 && active ? '#4FA3FF' : 'rgba(255,255,255,0.75)'} />
              </View>
              <Text style={[styles.stepText, i > 0 && { color: 'rgba(255,255,255,0.72)' }]} numberOfLines={2}>{h.caption}</Text>
              <Text style={styles.stepTime}>{formatStepTime(h.at)}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000' },
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  site: { height: 48, borderRadius: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '62%', flexShrink: 1 },
  siteText: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  siteInput: { flex: 1, color: '#fff', fontSize: 16, padding: 0 },
  shimmerWrap: { marginHorizontal: 28, marginBottom: 8, height: 2 },
  pageWrap: { flex: 1, marginHorizontal: 10 },
  glow: { ...StyleSheet.absoluteFillObject, borderRadius: 30, margin: -4, borderWidth: 4, borderColor: 'rgba(10,132,255,0.55)', shadowColor: '#0A84FF', shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  page: { flex: 1, borderRadius: 26, overflow: 'hidden', backgroundColor: '#fff' },
  pageTakeover: { borderWidth: 2, borderColor: '#0A84FF' },
  banner: { position: 'absolute', left: 12, right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, overflow: 'hidden' },
  reason: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, overflow: 'hidden' },
  bannerIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 12 },
  bar: { flex: 1, height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 14, gap: 10 },
  chip: { height: 60, borderRadius: 30, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  tpToggle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tpOn: { backgroundColor: '#0A84FF', shadowColor: '#0A84FF', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  chipPrimary: { backgroundColor: '#0A84FF', shadowColor: '#0A84FF', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  chipAlert: { backgroundColor: '#FFD60A', shadowColor: '#FFD60A', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  chipText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  kbSink: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, bottom: 0 },
  workingText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500', letterSpacing: -0.3 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 12, right: 12, borderRadius: 26, paddingHorizontal: 16, paddingTop: 8, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  sheetCount: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  stepIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, color: '#fff', fontSize: 15, letterSpacing: -0.2 },
  stepTime: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontVariant: ['tabular-nums'] },
});
