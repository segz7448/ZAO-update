/**
 * ZAO - Step Detail Sheet (solid Muse sheet). Real data from one plan_steps row with
 * `.actions` (getPlan): thought process (step.reasoning), what the step
 * does (description / action / target), the tool-call chain from
 * plan_step_actions (collapsible monospace input_json / output_json with
 * copy), and a status history built only from real timestamps.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { GlassFill, glassSurface, Grabber, haptic, CircleButton } from '../ui/ios';
import { AppIconTile, iconFor } from '../ui/icons';
import { StatusGlyph, statusColor, Capsule } from '../components/planFx';
import { stepDuration, formatDuration, stepHistory } from '../services/planning/planView';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
function prettyJson(raw) {
  if (!raw) return null;
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch (err) { return String(raw); }
}
const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '');

export default function StepDetailSheet({ step, visible, onClose, theme }) {
  const [open, setOpen] = useState({});
  const [thought, setThought] = useState(true);
  if (!step) return null;
  const actions = step.actions || [];
  const dur = stepDuration(step);
  const history = stepHistory(step);
  const toggle = (k) => { haptic.select(); setOpen((o) => ({ ...o, [k]: !o[k] })); };
  const card = [styles.card, glassSurface(theme, 20)];
  const H = ({ icon, children }) => (
    <View style={styles.hRow}><Ionicons name={icon} size={15} color={theme.textSecondary} /><Text style={[styles.h, { color: theme.textSecondary }]}>{children}</Text></View>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.scrim} onPress={onClose} accessibilityLabel="Close step details" />
      <View style={[styles.sheet, { backgroundColor: theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF'), borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
        <Grabber theme={theme} />
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: theme.mode === 'dark' ? '#A1A1A6' : '#5a5a5a' }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{step.description}</Text>
            <View style={styles.headMeta}>
              <StatusGlyph status={step.status} theme={theme} size={18} />
              <Text style={[styles.meta, { color: statusColor(theme, step.status) }]} maxFontSizeMultiplier={1.2}>{labelFor(step.status)}</Text>
              <Text style={[styles.meta, { color: theme.textTertiary }]} maxFontSizeMultiplier={1.2}>· {iconFor(step.domain).label}{dur != null ? ` · ${formatDuration(dur)}` : ''}</Text>
            </View>
          </View>
          <CircleButton theme={theme} icon="close" size={36} iconSize={18} label="Close" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {step.is_risky ? <View style={{ flexDirection: 'row', marginBottom: 12 }}><Capsule theme={theme} icon="shield-half" label={step.risk_reason || 'Risky step'} color={statusColor(theme, 'awaiting_approval')} /></View> : null}
          {step.status === 'failed' && step.error_message ? (
            <View style={[card, { borderColor: `${statusColor(theme, 'failed')}55` }]}>
              <GlassFill theme={theme} radius={20} />
              <H icon="alert-circle">Error</H>
              <Text style={[styles.mono, { color: statusColor(theme, 'failed') }]} selectable>{step.error_message}</Text>
            </View>
          ) : null}
          {step.reasoning ? (
            <View style={card}><GlassFill theme={theme} radius={20} />
              <TouchableOpacity onPress={() => { haptic.select(); setThought(!thought); }} style={styles.hRow} accessibilityRole="button">
                <Ionicons name="sparkles" size={15} color={theme.textSecondary} /><Text style={[styles.h, { color: theme.textSecondary, flex: 1 }]}>Thought process</Text>
                <Ionicons name={thought ? 'chevron-up' : 'chevron-down'} size={15} color={theme.textTertiary} />
              </TouchableOpacity>
              {thought ? <Text style={[styles.p, { color: theme.textPrimary }]}>{step.reasoning}</Text> : null}
            </View>
          ) : null}
          <View style={card}><GlassFill theme={theme} radius={20} />
            <H icon="information-circle">What this step does</H>
            <Text style={[styles.p, { color: theme.textPrimary }]}>{step.description}</Text>
            {step.action ? <Row theme={theme} k="Action" v={step.action} /> : null}
            {step.target ? <Row theme={theme} k="Target" v={step.target} /> : null}
          </View>
          <View style={card}><GlassFill theme={theme} radius={20} />
            <H icon="git-commit">Tool calls · {actions.filter((a) => a.entry_type !== 'reasoning').length}</H>
            {actions.length === 0 ? <Text style={[styles.p, { color: theme.textTertiary }]}>No tool calls recorded yet.</Text> : actions.map((a, i) => (
              <View key={a.id || i} style={styles.chainItem}>
                <View style={styles.chainRail}>
                  {a.entry_type === 'reasoning' ? <Ionicons name="bulb" size={18} color={theme.textTertiary} /> : <AppIconTile k={a.tool_name || step.domain} size={24} />}
                  {i < actions.length - 1 ? <View style={[styles.chainLine, { backgroundColor: theme.separator }]} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                  {a.entry_type === 'reasoning' ? (
                    <Text style={[styles.p, { color: theme.textSecondary, fontStyle: 'italic' }]}>{a.reasoning_text || 'Reasoning'}</Text>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => toggle(a.id || i)} style={styles.callHead} accessibilityRole="button">
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.callLabel, { color: theme.textPrimary }]} numberOfLines={2}>{a.label || a.tool_name}</Text>
                          <Text style={[styles.callTool, { color: theme.textTertiary }]} numberOfLines={1}>{a.tool_name}{a.completed_at || a.started_at ? ` · ${clock(a.completed_at || a.started_at)}` : ''}</Text>
                        </View>
                        <StatusGlyph status={a.status === 'done' ? 'done' : a.status} theme={theme} size={18} />
                        <Ionicons name={open[a.id || i] ? 'chevron-up' : 'chevron-down'} size={15} color={theme.textTertiary} />
                      </TouchableOpacity>
                      {open[a.id || i] ? (<>
                        <Code theme={theme} title="Input" text={prettyJson(a.input_json)} />
                        <Code theme={theme} title="Output" text={prettyJson(a.output_json)} />
                      </>) : null}
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
          {history.length ? (
            <View style={card}><GlassFill theme={theme} radius={20} />
              <H icon="time">Status history</H>
              {history.map((h, i) => (
                <View key={i} style={styles.histRow}>
                  <StatusGlyph status={h.status} theme={theme} size={16} />
                  <Text style={[styles.histLabel, { color: theme.textPrimary }]} numberOfLines={1}>{h.label}</Text>
                  <Text style={[styles.histTime, { color: theme.textTertiary }]}>{clock(h.at)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ theme, k, v }) {
  return <View style={styles.kv}><Text style={[styles.k, { color: theme.textTertiary }]}>{k}</Text><Text style={[styles.v, { color: theme.textPrimary }]} numberOfLines={3} selectable>{v}</Text></View>;
}

function Code({ theme, title, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (!text) return; await Clipboard.setStringAsync(text); haptic.success(); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  return (
    <View style={[styles.code, { backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(60,60,67,0.06)' }]}>
      <View style={styles.codeHead}>
        <Text style={[styles.codeTitle, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
        {text ? (
          <TouchableOpacity onPress={copy} style={styles.copy} accessibilityRole="button" accessibilityLabel={`Copy ${title}`}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={theme.brandStrong} />
            <Text style={[styles.copyText, { color: theme.brandStrong }]}>{copied ? 'Copied' : 'Copy'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[styles.mono, { color: theme.textPrimary }]} selectable>{text || '(none)'}</Text>
      </ScrollView>
    </View>
  );
}

const LABELS = { pending: 'Up next', running: 'Running', awaiting_approval: 'Needs approval', done: 'Done', failed: 'Failed', skipped: 'Skipped', blocked: 'Blocked', paused: 'Paused' };
const labelFor = (s) => LABELS[s] || s;

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 24 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: 0.38, lineHeight: 25 },
  headMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  meta: { fontSize: 13, fontWeight: '500', letterSpacing: -0.08 },
  body: { paddingHorizontal: 16, paddingBottom: 30 },
  card: { padding: 14, marginBottom: 12, gap: 8 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h: { fontSize: 13, fontWeight: '600', letterSpacing: -0.08, textTransform: 'uppercase' },
  p: { fontSize: 15, lineHeight: 21, letterSpacing: -0.24 },
  kv: { flexDirection: 'row', gap: 10 },
  k: { width: 56, fontSize: 13 },
  v: { flex: 1, fontSize: 13, fontFamily: MONO },
  chainItem: { flexDirection: 'row', gap: 10 },
  chainRail: { width: 24, alignItems: 'center' },
  chainLine: { flex: 1, width: 2, borderRadius: 1, marginTop: 4 },
  callHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  callLabel: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24 },
  callTool: { fontSize: 12, fontFamily: MONO, marginTop: 1 },
  code: { borderRadius: 12, padding: 10, marginTop: 8 },
  codeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  codeTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 28, paddingHorizontal: 4 },
  copyText: { fontSize: 13, fontWeight: '600' },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 17 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
  histLabel: { flex: 1, fontSize: 14, letterSpacing: -0.15 },
  histTime: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
