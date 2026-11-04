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
 *   bottom: "Type into page…" + "Done - hand back" during takeover
 *           (manualType / manualKey('Enter') / resumeAfterHuman), the
 *           current step while running, or a new-task field when idle.
 * One bottom bar only, so takeover and task input never overlap.
 * When no task has run yet, BrowserStreamView shows its idle
 * "Connected - waiting for a task" placeholder; starting a task here makes
 * browserCardStore add the inline card to the chat (same as any task).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, BackHandler, ActivityIndicator } from 'react-native';
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
}) {
  const insets = useSafeAreaInsets();
  const [taskText, setTaskText] = useState('');
  const [manualText, setManualText] = useState('');
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

  if (!visible) return null;

  const sendTask = () => {
    const t = taskText.trim();
    if (!t || !stream) return;
    haptic.light();
    stream.runTask(t);
    setTaskText('');
  };
  const stop = () => { haptic.warning(); if (stream?.cancel()) dispatchCard({ type: 'stopRequested' }); };
  const submitAddress = () => { if (addressText.trim()) stream?.navigateTo(addressText.trim()); setEditingAddress(false); };
  const sendManual = () => { if (!manualText.trim()) return; stream?.manualType(manualText); setManualText(''); };

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

      {/* live page in a rounded sheet */}
      <View style={styles.page}>
        <BrowserStreamView frameBase64={frameBase64} stream={stream} interactive={awaitingHuman} connected={connected} connectionError={connectionError} isRunning={isRunning} zoom={zoom} />
        {awaitingHuman && humanReason ? (
          <View style={styles.reason}><Ionicons name="hand-left" size={14} color="#FFD60A" /><Text style={styles.reasonText} numberOfLines={2}>{humanReason}</Text></View>
        ) : null}
      </View>

      {/* bottom field: takeover (Type into page… + Done - hand back), running caption, or new task */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.bar, glass, { marginBottom: Math.max(10, insets.bottom) }]}>
          <Glass r={28} />
          {awaitingHuman ? (
            <>
              <TextInput style={styles.barInput} value={manualText} onChangeText={setManualText} placeholder="Type into page…" placeholderTextColor="#8E8E93"
                returnKeyType="send" onSubmitEditing={() => { if (manualText.trim()) sendManual(); else stream?.manualKey('Enter'); }} />
              <TouchableOpacity onPress={() => { haptic.success(); if (manualText.trim()) sendManual(); stream?.resumeAfterHuman(); }} style={styles.done} accessibilityLabel="Done - hand back to the agent">
                <Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.doneText}>Done - hand back</Text>
              </TouchableOpacity>
            </>
          ) : isRunning ? (
            <View style={styles.workingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.workingText} numberOfLines={1}>{activeCard?.caption || 'Working on it…'}</Text>
            </View>
          ) : (
            <>
              <TextInput style={styles.barInput} value={taskText} onChangeText={setTaskText} onSubmitEditing={sendTask}
                placeholder="Tell the browser what to do…" placeholderTextColor="#8E8E93" returnKeyType="go" />
              <TouchableOpacity onPress={sendTask} accessibilityLabel="Start browser task" style={[styles.send, { backgroundColor: taskText.trim() ? '#0A84FF' : 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
  bar: { marginHorizontal: 10, marginTop: 10, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6, gap: 8, overflow: 'hidden' },
  barInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 10 },
  done: { height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: '#0A84FF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  workingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  workingText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
});
