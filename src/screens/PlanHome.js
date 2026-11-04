/**
 * ZAO - Plans home (Plan tab with no plan picked).
 * Solid opaque rows (Muse): small status pill/ring, 15–16px semibold title,
 * 13px gray meta. Plans cannot be deleted; Stop lives in the chat composer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrostedBar, CircleButton, haptic } from '../ui/ios';
import { usePlanStore } from '../store/planStore';
import { StatusGlyph, PLAN_STATUS_LABEL } from '../components/planFx';
import { groupPlans, filterPlans, FILTERS, summaryStatus, summaryProgress, needsYou, formatAgo, TERMINAL, displayGoal, isPlanStalled } from '../services/planning/planView';

export default function PlanHome({ theme, onOpenPlan, onBackToChat }) {
  const { planSummaries, summariesLoaded, loadPlanSummaries } = usePlanStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => { loadPlanSummaries(); }, [loadPlanSummaries]);
  const anyLive = planSummaries.some((p) => !TERMINAL.includes(summaryStatus(p)));
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); if (anyLive) loadPlanSummaries(); }, anyLive ? 2500 : 30000);
    return () => clearInterval(t);
  }, [anyLive, loadPlanSummaries]);

  const groups = useMemo(() => groupPlans(filterPlans(planSummaries, { query, filter })), [planSummaries, query, filter]);
  const empty = summariesLoaded && planSummaries.length === 0;
  const cardBg = theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <FrostedBar theme={theme} style={[styles.bar, { borderBottomColor: theme.separator }]}>
        <CircleButton theme={theme} icon="chevron-back" label="Back to chat" onPress={onBackToChat} />
        <Text style={[styles.barTitle, { color: theme.textPrimary }]} maxFontSizeMultiplier={1.2}>Plans</Text>
        <View style={{ width: 44 }} />
      </FrostedBar>
      {!summariesLoaded ? (
        <View style={styles.center}><ActivityIndicator color={theme.textSecondary} /></View>
      ) : empty ? (
        <EmptyPlans theme={theme} onBackToChat={onBackToChat} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <View style={[styles.search, { backgroundColor: cardBg, borderColor: theme.separator }]}>
            <Ionicons name="search" size={16} color={theme.textTertiary} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search plans" placeholderTextColor={theme.textTertiary}
              style={[styles.searchInput, { color: theme.textPrimary }]} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"
              accessibilityLabel="Search plans" maxFontSizeMultiplier={1.2} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <TouchableOpacity key={f.key} onPress={() => { haptic.select(); setFilter(f.key); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.chip, { backgroundColor: on ? theme.textPrimary : cardBg, borderColor: theme.separator }]}>
                  <Text style={[styles.chipText, { color: on ? (theme.mode === 'dark' ? '#000' : '#fff') : theme.textPrimary }]} maxFontSizeMultiplier={1.2}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {groups.length === 0 ? (
            <Text style={[styles.noMatch, { color: theme.textSecondary }]}>No plans match.</Text>
          ) : groups.map((g) => (
            <View key={g.key}>
              <Text style={[styles.section, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.2}>{g.title.toUpperCase()}</Text>
              <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: theme.separator }]}>
                {g.data.map((p, i) => (
                  <PlanRow key={p.id} plan={p} theme={theme} now={now} last={i === g.data.length - 1}
                    onPress={() => { haptic.light(); onOpenPlan(p.id); }} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function statusPill(plan, theme, now) {
  const status = summaryStatus(plan);
  const stalled = isPlanStalled(plan, now);
  if (needsYou(plan)) return { label: plan.awaiting_steps ? 'Needs you' : status === 'paused' ? 'Checkpoint' : 'Ready', bg: theme.mode === 'dark' ? '#FF9F0A' : '#FF9500', fg: '#fff' };
  if (stalled) return { label: 'Stalled', bg: theme.mode === 'dark' ? '#FF9F0A' : '#FF9500', fg: '#fff' };
  if (status === 'completed' || status === 'done') return { label: 'Done', bg: theme.mode === 'dark' ? '#30D158' : '#34C759', fg: '#fff' };
  if (status === 'failed') return { label: 'Failed', bg: theme.mode === 'dark' ? '#FF453A' : '#FF3B30', fg: '#fff' };
  if (status === 'cancelled') return { label: 'Cancelled', bg: theme.textTertiary, fg: '#fff' };
  if (['running', 'planning', 'recovering'].includes(status)) return { label: 'In progress', bg: theme.mode === 'dark' ? '#FFFFFF' : '#000000', fg: theme.mode === 'dark' ? '#000' : '#fff' };
  return { label: PLAN_STATUS_LABEL[status] || status, bg: theme.textTertiary, fg: '#fff' };
}

function PlanRow({ plan, theme, now, onPress, last }) {
  const status = summaryStatus(plan);
  const prog = summaryProgress(plan);
  const pill = statusPill(plan, theme, now);
  const title = displayGoal(plan);
  const meta = [
    pill.label,
    prog.total ? `${prog.done}/${prog.total} steps` : null,
    formatAgo(plan.last_activity_at, now),
    isPlanStalled(plan, now) ? 'no progress >30m' : null,
  ].filter(Boolean).join(' · ');
  const glyphStatus = isPlanStalled(plan, now) ? 'paused' : needsYou(plan) ? 'awaiting_approval' : status;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${title}. ${pill.label}. ${meta}`}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }]}>
      <View style={styles.leftMark}>
        <StatusGlyph status={glyphStatus} theme={theme} size={24} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{title}</Text>
        <Text style={[styles.rowMeta, { color: theme.textTertiary }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} style={{ marginTop: 2 }} />
    </TouchableOpacity>
  );
}

export function EmptyPlans({ theme, onBackToChat }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.illoIcon, { backgroundColor: theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF') }]}>
        <Ionicons name="list-outline" size={40} color={theme.mode === 'dark' ? '#BF5AF2' : '#AF52DE'} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]} maxFontSizeMultiplier={1.2}>No plans yet</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.2}>
        Give ZAO a bigger goal in chat and it will break it into steps you can review and follow here.
      </Text>
      <TouchableOpacity onPress={() => { haptic.light(); onBackToChat?.(); }} style={[styles.emptyBtn, { backgroundColor: theme.brandStrong }]} accessibilityRole="button">
        <Text style={styles.emptyBtnText} maxFontSizeMultiplier={1.2}>Ask ZAO to plan something</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 56, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  barTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 },
  search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15, letterSpacing: -0.24, padding: 0 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.16 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  groupCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  noMatch: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 72 },
  leftMark: { width: 28, height: 28, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 3, paddingRight: 4 },
  rowTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.32, lineHeight: 21 },
  rowMeta: { fontSize: 13, letterSpacing: -0.08, lineHeight: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },
  illoIcon: { width: 88, height: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0.35 },
  emptyBody: { fontSize: 15, lineHeight: 20, textAlign: 'center', marginTop: 8, letterSpacing: -0.24 },
  emptyBtn: { marginTop: 24, height: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: -0.32 },
});
