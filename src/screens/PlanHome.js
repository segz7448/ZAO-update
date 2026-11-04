/**
 * ZAO - Plans home (the Plan tab with no plan picked).
 * Real data only: planStore.loadPlanSummaries() -> database.getPlanSummaries()
 * (top-level plans, step/milestone counts rolled up across each tree).
 * Sections: Needs you / Active / Recent; search + filter chips; glass
 * cards with goal, status light, progress ring (x/y steps) and last
 * activity; swipe left for Cancel / Delete (delete asks first).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, PanResponder, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrostedBar, CircleButton, GlassFill, glassSurface, haptic } from '../ui/ios';
import { usePlanStore } from '../store/planStore';
import { LiveLight, useReduceMotion } from '../components/browserFx';
import { ArcRing, AreaTile, statusColor, PLAN_STATUS_LABEL } from '../components/planFx';
import { groupPlans, filterPlans, FILTERS, summaryStatus, summaryProgress, needsYou, formatAgo, TERMINAL } from '../services/planning/planView';

export default function PlanHome({ theme, onOpenPlan, onBackToChat, onCancelPlan }) {
  const { planSummaries, summariesLoaded, loadPlanSummaries, removePlan } = usePlanStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => { loadPlanSummaries(); }, [loadPlanSummaries]);
  // live: re-read while anything is still in flight (DB is the source of truth)
  const anyLive = planSummaries.some((p) => !TERMINAL.includes(summaryStatus(p)));
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); if (anyLive) loadPlanSummaries(); }, anyLive ? 2500 : 30000);
    return () => clearInterval(t);
  }, [anyLive, loadPlanSummaries]);

  const groups = useMemo(() => groupPlans(filterPlans(planSummaries, { query, filter })), [planSummaries, query, filter]);
  const empty = summariesLoaded && planSummaries.length === 0;

  const confirmDelete = (p) => {
    haptic.warning();
    Alert.alert('Delete plan?', `"${p.goal}" and all of its steps will be removed from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { haptic.medium(); await removePlan(p.id); loadPlanSummaries(); } },
    ]);
  };
  const cancel = async (p) => { haptic.warning(); await onCancelPlan?.(p.id); loadPlanSummaries(); };

  return (
    <View style={styles.flex}>
      <FrostedBar theme={theme} style={[styles.bar, { borderBottomColor: theme.separator }]}>
        <CircleButton theme={theme} icon="chevron-back" label="Back to chat" onPress={onBackToChat} />
        <Text style={[styles.barTitle, { color: theme.textPrimary }]}>Plans</Text>
        <View style={{ width: 44 }} />
      </FrostedBar>
      {!summariesLoaded ? (
        <View style={styles.center}><ActivityIndicator color={theme.textSecondary} /></View>
      ) : empty ? (
        <EmptyPlans theme={theme} onBackToChat={onBackToChat} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <View style={[styles.search, glassSurface(theme, 14)]}>
            <GlassFill theme={theme} radius={14} />
            <Ionicons name="search" size={17} color={theme.textTertiary} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search plans" placeholderTextColor={theme.textTertiary}
              style={[styles.searchInput, { color: theme.textPrimary }]} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel="Search plans" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <TouchableOpacity key={f.key} onPress={() => { haptic.select(); setFilter(f.key); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.chip, on ? { backgroundColor: theme.textPrimary } : glassSurface(theme, 17)]}>
                  {on ? null : <GlassFill theme={theme} radius={17} />}
                  <Text style={[styles.chipText, { color: on ? theme.background : theme.textPrimary }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {groups.length === 0 ? (
            <Text style={[styles.noMatch, { color: theme.textSecondary }]}>No plans match.</Text>
          ) : groups.map((g) => (
            <View key={g.key}>
              <Text style={[styles.section, { color: theme.textSecondary }]}>{g.title.toUpperCase()} · {g.data.length}</Text>
              {g.data.map((p) => (
                <SwipeRow key={p.id} theme={theme} canCancel={!TERMINAL.includes(summaryStatus(p))} onCancel={() => cancel(p)} onDelete={() => confirmDelete(p)}>
                  <PlanCard plan={p} theme={theme} now={now} onPress={() => { haptic.light(); onOpenPlan(p.id); }} />
                </SwipeRow>
              ))}
            </View>
          ))}
          <Text style={[styles.hint, { color: theme.textTertiary }]}>Swipe a plan left to cancel or delete it.</Text>
        </ScrollView>
      )}
    </View>
  );
}

function PlanCard({ plan, theme, now, onPress }) {
  const status = summaryStatus(plan);
  const prog = summaryProgress(plan);
  const c = statusColor(theme, needsYou(plan) ? 'awaiting_approval' : status);
  const live = !TERMINAL.includes(status);
  const label = needsYou(plan) ? (plan.awaiting_steps ? 'Needs approval' : status === 'paused' ? 'Checkpoint' : 'Ready to start') : PLAN_STATUS_LABEL[status] || status;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, glassSurface(theme, 22)]} accessibilityRole="button"
      accessibilityLabel={`${plan.goal}. ${label}. ${prog.done} of ${prog.total} steps`}>
      <GlassFill theme={theme} radius={22} />
      <View style={styles.cardTop}>
        <ArcRing fraction={prog.fraction} size={46} stroke={4} color={c} track={theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.12)'}>
          {status === 'completed' ? <Ionicons name="checkmark" size={20} color={c} />
            : <Text style={[styles.ringText, { color: theme.textPrimary }]}>{prog.done}<Text style={{ color: theme.textTertiary }}>/{prog.total}</Text></Text>}
        </ArcRing>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.goal, { color: theme.textPrimary }]} numberOfLines={2}>{plan.goal}</Text>
          <View style={styles.metaRow}>
            <LiveLight color={c} pulse={live && status !== 'paused'} size={7} />
            <Text style={[styles.meta, { color: c, fontWeight: '600' }]}>{label}</Text>
            <Text style={[styles.meta, { color: theme.textTertiary }]}>· {formatAgo(plan.last_activity_at, now)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
      </View>
      {plan.current_step && live ? (
        <View style={[styles.current, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(60,60,67,0.06)' }]}>
          <Ionicons name={plan.current_step_status === 'awaiting_approval' ? 'warning' : 'play-circle'} size={14} color={c} />
          <Text style={[styles.currentText, { color: theme.textSecondary }]} numberOfLines={1}>{plan.current_step}</Text>
        </View>
      ) : null}
      {plan.total_milestones ? (
        <Text style={[styles.ms, { color: theme.textTertiary }]}>{plan.reached_milestones}/{plan.total_milestones} milestones</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const ACTION_W = 84;
function SwipeRow({ children, theme, canCancel, onCancel, onDelete }) {
  const rm = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(0);
  const width = (canCancel ? 2 : 1) * ACTION_W;
  const snap = (to) => { open.current = to; (rm ? Animated.timing(x, { toValue: to, duration: 0, useNativeDriver: true }) : Animated.spring(x, { toValue: to, useNativeDriver: true, friction: 9, tension: 80 })).start(); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => x.setValue(Math.min(0, Math.max(-width - 24, open.current + g.dx))),
    onPanResponderRelease: (_, g) => { const end = open.current + g.dx; if (end < -width / 2) { haptic.select(); snap(-width); } else snap(0); },
    onPanResponderTerminate: () => snap(0),
  })).current;
  return (
    <View style={styles.swipe}>
      <View style={[styles.actions, { width }]}>
        {canCancel ? (
          <TouchableOpacity style={[styles.action, { backgroundColor: theme.mode === 'dark' ? '#FF9F0A' : '#FF9500' }]} onPress={() => { snap(0); onCancel(); }} accessibilityLabel="Cancel plan">
            <Ionicons name="stop-circle" size={22} color="#fff" /><Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.action, { backgroundColor: theme.mode === 'dark' ? '#FF453A' : '#FF3B30' }]} onPress={() => { snap(0); onDelete(); }} accessibilityLabel="Delete plan">
          <Ionicons name="trash" size={21} color="#fff" /><Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>{children}</Animated.View>
    </View>
  );
}

export function EmptyPlans({ theme, onBackToChat }) {
  return (
    <View style={styles.empty}>
      <View style={styles.illo}>
        <View style={[styles.illoGlass, glassSurface(theme, 36)]}><GlassFill theme={theme} radius={36} strong />
          <Ionicons name="list" size={46} color={theme.mode === 'dark' ? '#BF5AF2' : '#AF52DE'} />
        </View>
        <View style={[styles.illoTile, { left: 2, top: 14, transform: [{ rotate: '-12deg' }] }]}><AreaTile domain="coding" size={40} /></View>
        <View style={[styles.illoTile, { right: 0, top: 6, transform: [{ rotate: '10deg' }] }]}><AreaTile domain="browser" size={40} /></View>
        <View style={[styles.illoTile, { left: 22, bottom: 0, transform: [{ rotate: '8deg' }] }]}><AreaTile domain="files" size={34} /></View>
        <View style={[styles.illoTile, { right: 18, bottom: 6, transform: [{ rotate: '-8deg' }] }]}><AreaTile domain="terminal" size={34} /></View>
      </View>
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No plans yet</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>Give ZAO a bigger goal in chat and it will break it into steps you can review, approve and follow live here.</Text>
      <TouchableOpacity onPress={() => { haptic.light(); onBackToChat?.(); }} style={[styles.emptyBtn, { backgroundColor: theme.brandStrong }]} accessibilityRole="button">
        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" /><Text style={styles.emptyBtnText}>Ask ZAO to plan something</Text>
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
  search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 17, letterSpacing: -0.41, padding: 0 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { height: 34, paddingHorizontal: 15, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: -0.08, marginTop: 10, marginBottom: 8, marginLeft: 4 },
  noMatch: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 16 },
  swipe: { marginBottom: 12 },
  actions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', gap: 6 },
  action: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: { padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.3 },
  goal: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, marginLeft: -5 },
  meta: { fontSize: 13, letterSpacing: -0.08 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, height: 30, borderRadius: 10 },
  currentText: { flex: 1, fontSize: 13, letterSpacing: -0.08 },
  ms: { fontSize: 12, marginLeft: 58, marginTop: -4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },
  illo: { width: 200, height: 150, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  illoGlass: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  illoTile: { position: 'absolute' },
  emptyTitle: { fontSize: 22, fontWeight: '700', letterSpacing: 0.35 },
  emptyBody: { fontSize: 15, lineHeight: 20, textAlign: 'center', marginTop: 8, letterSpacing: -0.24 },
  emptyBtn: { marginTop: 24, height: 50, borderRadius: 25, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyBtnText: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
});
