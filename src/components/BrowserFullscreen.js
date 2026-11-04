/**
 * ZAO - Browser fullscreen view (the expanded form of the inline chat
 * BrowserCard, and what the chat header's desktop icon opens).
 *
 * Replaces the retired BrowserAgentPiP fullscreen + BrowserAgentScreen
 * chrome pair. It renders the SAME App-owned BrowserAgentStream (no new
 * socket) through BrowserStreamView, with glass iOS chrome on top:
 *   top:    round collapse chevron, site pill (tap to type a URL), square
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
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, BackHandler, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BrowserStreamView from '../services/browserAgent/BrowserStreamView';
import { BlurView } from 'expo-blur';
import { haptic } from '../ui/ios';
import { domainFromUrl } from '../services/browserAgent/browserCardState';
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
    : takeover ? 'You have control - tap the page'
    : awaitingHuman ? (humanReason ? `Needs you: ${humanReason}` : 'Needs you to take over')
    : isRunning ? (activeCard?.caption || 'Working on it…')
    : hasSession ? (activeCard?.caption || 'Idle') : 'Waiting for a task from chat';

  const domain = domainFromUrl(currentUrl);
  const active = isRunning || awaitingHuman;
  const glass = { backgroundColor: 'rgba(40,40,44,0.72)', borderColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth };
  const Glass = ({ r }) => (Platform.OS === 'ios' ? <BlurView tint="dark" intensity={50} style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]} /> : null);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      {/* top chrome: round collapse chevron · site pill · square stop */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => { haptic.light(); onClose?.(); }} style={[styles.round, glass]} accessibilityRole="button" accessibilityLabel="Collapse browser" hitSlop={6}>
          <Glass r={24} /><Ionicons name="chevron-down" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => { setAddressText(currentUrl); setEditingAddress(true); }}
          style={[styles.site, glass, editingAddress && { flex: 1 }]}
          accessibilityLabel="Site address"
        >
          <Glass r={24} />
          <Ionicons name="globe-outline" size={16} color="#4FA3FF" />
          {editingAddress ? (
            <TextInput style={styles.siteInput} value={addressText} onChangeText={setAddressText} onSubmitEditing={submitAddress}
              onBlur={() => setEditingAddress(false)} autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="url"
              placeholder="Enter address" placeholderTextColor="#8E8E93" returnKeyType="go" selectTextOnFocus />
          ) : (
            <Text style={styles.siteText} numberOfLines={1}>{domain || 'New tab'}</Text>
          )}
        </TouchableOpacity>
        {active ? (
          <TouchableOpacity onPress={stop} style={[styles.round, glass]} accessibilityRole="button" accessibilityLabel="Stop task" hitSlop={6}>
            <Glass r={24} /><View style={styles.stopSquare} />
          </TouchableOpacity>
        ) : <View style={styles.round} />}
      </View>

      {/* live page in a rounded sheet; taps are forwarded only in takeover */}
      <View style={styles.page} onTouchEnd={takeover ? () => kbRef.current?.focus() : undefined}>
        <BrowserStreamView frameBase64={frameBase64} stream={stream} interactive={takeover} connected={connected} connectionError={connectionError} isRunning={isRunning} zoom={zoom} />
        {awaitingHuman && !takeover ? (
          <View style={styles.reason} pointerEvents="none"><Ionicons name="hand-left" size={14} color="#FFD60A" /><Text style={styles.reasonText} numberOfLines={2}>{humanReason || 'The agent needs you to take over.'}</Text></View>
        ) : null}
      </View>
      {takeover ? (
        <TextInput ref={kbRef} value={kbValue} onChangeText={onKbChange} onSubmitEditing={() => stream?.manualKey('Enter')} blurOnSubmit={false}
          autoCapitalize="none" autoCorrect={false} caretHidden style={styles.kbSink} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}

      {/* bottom: live status pill streaming the current step + Take over / Done chip */}
      <View style={[styles.bottomRow, { marginBottom: Math.max(10, insets.bottom) }]}>
        <View style={[styles.bar, glass]}>
          <Glass r={28} />
          {isRunning && !takeover ? <ActivityIndicator size="small" color="#fff" /> : <View style={[styles.dot, { backgroundColor: takeover ? '#0A84FF' : awaitingHuman ? '#FFD60A' : hasSession ? '#30D158' : '#8E8E93' }]} />}
          <Text style={styles.workingText} numberOfLines={1}>{statusText}</Text>
        </View>
        {takeover ? (
          <TouchableOpacity onPress={finishTakeover} style={[styles.chip, styles.chipPrimary]} accessibilityRole="button" accessibilityLabel="Done - hand control back">
            <Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.chipText}>Done</Text>
          </TouchableOpacity>
        ) : canTakeOver ? (
          <TouchableOpacity onPress={startTakeover} style={[styles.chip, glass, awaitingHuman && styles.chipAlert]} accessibilityRole="button" accessibilityLabel="Take over the browser">
            {awaitingHuman ? null : <Glass r={28} />}<Ionicons name="hand-left-outline" size={16} color={awaitingHuman ? '#1C1C1E' : '#fff'} />
            <Text style={[styles.chipText, awaitingHuman && { color: '#1C1C1E' }]}>Take over</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff' },
  site: { height: 48, borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '60%', overflow: 'hidden' },
  siteText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  siteInput: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },
  page: { flex: 1, marginHorizontal: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  reason: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.75)' },
  reasonText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 10, marginTop: 10 },
  bar: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, overflow: 'hidden' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  chip: { height: 56, borderRadius: 28, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  chipPrimary: { backgroundColor: '#0A84FF' },
  chipAlert: { backgroundColor: '#FFD60A', borderColor: '#FFD60A' },
  chipText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  kbSink: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, bottom: 0 },
  workingText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
});
