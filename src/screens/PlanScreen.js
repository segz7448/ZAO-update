/**
 * ZAO - Plan tab. No planId -> Plans home (PlanHome.js, auto-opening a
 * running plan once). With a planId -> plan detail:
 *   hero (goal, animated progress ring, pulsing status badge, elapsed,
 *   step/milestone counts, Stop) that collapses into the frosted bar;
 *   interactive milestone timeline (tap filters steps); vertical step
 *   timeline (area tiles from src/ui/icons.js, risk chips, collapsible
 *   sub-tasks, error expansion, real durations, live shimmer); browser
 *   step thumbnail from App's live frame; StepDetailSheet; a state-aware
 *   glass dock (Start / Allow-Deny / Checkpoint / live status); and a
 *   completion moment. Live: refreshActivePlan polls every 1.5 s while
 *   the plan is non-terminal and this screen is open (the store itself
 *   only refreshes after actions). There is no user pause in planStore,
 *   so no Pause control is offered.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Image, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FrostedBar, CircleButton, GlassFill, glassSurface, haptic, AllowButton, DenyButton } from '../ui/ios';
import { AppIconTile, iconFor } from '../ui/icons';
import { usePlanStore } from '../store/planStore';
import { useTheme } from '../theme/useTheme';
import { LiveLight, useReduceMotion, FadeSwapText } from '../components/browserFx';
import { ArcRing, StatusGlyph, statusColor, RowShimmer, Capsule, PLAN_STATUS_LABEL } from '../components/planFx';
import { TERMINAL, stepProgress, stepDuration, planElapsed, formatDuration, milestoneStates, stepTree, dockState, completionSummary, pickAutoOpen } from '../services/planning/planView';
import StepDetailSheet from './StepDetailSheet';
import PlanHome from './PlanHome';

export default function PlanScreen(props) {
  const theme = useTheme();
  const { planId, onOpenPlan } = props;
  const { planSummaries, summariesLoaded } = usePlanStore();
  const autoOpened = useRef(false);
  useEffect(() => {
    if (planId || autoOpened.current || !summariesLoaded) return;
    autoOpened.current = true;
    const run = pickAutoOpen(planSummaries);
    if (run) onOpenPlan?.(run.id);
  }, [planId, summariesLoaded, planSummaries, onOpenPlan]);
  if (!planId) {
    return <PlanHome theme={theme} onOpenPlan={(id) => onOpenPlan?.(id)} onBackToChat={props.onClose} onCancelPlan={props.onCancelPlan} />;
  }
  return <PlanDetail {...props} theme={theme} />;
}

function PlanDetail({ theme, planId, onClose, onOpenPlan, onApproveStep, onRejectStep, onCancelPlan, onAcceptCheckpoint, onDismissCheckpoint, onStartPlan, onOpenBrowser, browserFrame }) {
  const insets = useSafeAreaInsets();
  const rm = useReduceMotion();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { activePlan, isLoading, loadPlan, refreshActivePlan } = usePlanStore();
  const [detailStep, setDetailStep] = useState(null);
  const [msFilter, setMsFilter] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [now, setNow] = useState(Date.now());
  const [celebrate, setCelebrate] = useState(false);
  const prevStatus = useRef(null);

  useEffect(() => { if (planId) loadPlan(planId); }, [planId, loadPlan]);
  const plan = activePlan && activePlan.id === planId ? activePlan : null;
  const live = plan && !TERMINAL.includes(plan.status);
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => { setNow(Date.now()); refreshActivePlan(); }, 1500);
    return () => clearInterval(t);
  }, [live, refreshActivePlan]);
  useEffect(() => {
    if (!plan) return;
    if (prevStatus.current && prevStatus.current !== plan.status) {
      if (plan.status === 'completed') { haptic.success(); setCelebrate(true); }
      else if (plan.status === 'failed') haptic.warning();
      else if (plan.status === 'awaiting_approval') haptic.warning();
    }
    prevStatus.current = plan.status;
  }, [plan?.status]);
  // keep the open sheet in sync with live data
  const sheetStep = detailStep && plan ? (plan.steps || []).find((s) => s.id === detailStep.id) || detailStep : detailStep;

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {isLoading ? <ActivityIndicator size="large" color={theme.textSecondary} /> : (
          <>
            <Ionicons name="document-text-outline" size={40} color={theme.textTertiary} />
            <Text style={[styles.missing, { color: theme.textSecondary }]}>This plan isn’t on this phone anymore.</Text>
            <TouchableOpacity onPress={() => onOpenPlan?.(null)} style={{ marginTop: 14 }}><Text style={{ color: theme.brandStrong, fontSize: 17 }}>All plans</Text></TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const steps = plan.steps || [];
  const prog = stepProgress(steps);
  const ms = milestoneStates(plan.milestones || [], steps);
  const tree = stepTree(steps, msFilter);
  const dock = dockState(plan);
  const sc = statusColor(theme, dock.kind === 'approval' ? 'awaiting_approval' : plan.status);
  const elapsed = planElapsed(plan, now);
  const label = dock.kind === 'approval' ? 'Needs your approval' : dock.kind === 'checkpoint' ? 'Checkpoint' : dock.kind === 'start' ? 'Ready to start' : PLAN_STATUS_LABEL[plan.status] || plan.status;
  const barTitleOpacity = scrollY.interpolate({ inputRange: [90, 150], outputRange: [0, 1], extrapolate: 'clamp' });
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 130], outputRange: [1, 0.2], extrapolate: 'clamp' });
  const heroScale = scrollY.interpolate({ inputRange: [-80, 0, 140], outputRange: [1.04, 1, 0.94], extrapolate: 'clamp' });
  const track = theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(60,60,67,0.1)';
  const stop = () => { haptic.warning(); onCancelPlan?.(plan.id); };

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16} contentContainerStyle={{ paddingTop: 64, paddingBottom: 140 + insets.bottom, paddingHorizontal: 16 }}>
        <Animated.View style={[styles.hero, glassSurface(theme, 28), { opacity: heroOpacity, transform: [{ scale: heroScale }] }]}>
          <GlassFill theme={theme} radius={28} strong />
          <View style={styles.heroTop}>
            <ArcRing fraction={prog.fraction} size={96} stroke={8} color={sc} track={track}>
              {plan.status === 'completed' ? <Ionicons name="checkmark" size={40} color={sc} /> : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.ringPct, { color: theme.textPrimary }]}>{Math.round(prog.fraction * 100)}%</Text>
                  <Text style={[styles.ringSub, { color: theme.textTertiary }]}>{prog.done}/{prog.total}</Text>
                </View>
              )}
            </ArcRing>
            <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <View style={[styles.badge, { backgroundColor: `${sc}1F`, borderColor: `${sc}55` }]}>
                <LiveLight color={sc} pulse={live && plan.status !== 'paused' && !rm} size={7} />
                <Text style={[styles.badgeText, { color: sc }]}>{label}</Text>
              </View>
              <View style={styles.stat}><Ionicons name="timer-outline" size={15} color={theme.textSecondary} /><Text style={[styles.statText, { color: theme.textSecondary }]}>{elapsed != null ? formatDuration(elapsed) : '—'}</Text></View>
              <View style={styles.stat}><Ionicons name="list-outline" size={15} color={theme.textSecondary} /><Text style={[styles.statText, { color: theme.textSecondary }]}>{prog.total} steps{ms.length ? ` · ${ms.filter((m) => m.state === 'done').length}/${ms.length} milestones` : ''}</Text></View>
            </View>
          </View>
          <Text style={[styles.goal, { color: theme.textPrimary }]}>{plan.goal}</Text>
          {live ? (
            <TouchableOpacity onPress={stop} style={[styles.stop, { backgroundColor: theme.deny }]} accessibilityRole="button" accessibilityLabel="Stop plan">
              <Ionicons name="stop-circle-outline" size={17} color={statusColor(theme, 'failed')} /><Text style={[styles.stopText, { color: statusColor(theme, 'failed') }]}>Stop</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>

        {ms.length ? (
          <View style={{ marginTop: 22 }}>
            <SectionTitle theme={theme} title="Milestones" right={msFilter ? 'Show all' : null} onRight={() => { haptic.select(); setMsFilter(null); }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, gap: 0 }}>
              {ms.map((m, i) => {
                const on = msFilter === m.id;
                const c = m.state === 'done' ? statusColor(theme, 'done') : m.state === 'current' ? statusColor(theme, 'running') : m.state === 'missed' ? statusColor(theme, 'failed') : theme.textTertiary;
                return (
                  <View key={m.id} style={styles.msItem}>
                    {i > 0 ? <View style={[styles.msLine, { backgroundColor: ms[i - 1].state === 'done' ? statusColor(theme, 'done') : theme.separator }]} /> : null}
                    <TouchableOpacity onPress={() => { haptic.select(); setMsFilter(on ? null : m.id); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={[styles.msCard, glassSurface(theme, 18), on && { borderColor: c, borderWidth: 1.5 }]}>
                      <GlassFill theme={theme} radius={18} />
                      <View style={styles.msHead}>
                        {m.state === 'done' ? <Ionicons name="checkmark-circle" size={20} color={c} /> : m.state === 'missed' ? <StatusGlyph status="missed" theme={theme} size={20} />
                          : m.state === 'current' ? <ArcRing fraction={m.stepCount ? m.doneCount / m.stepCount : 0} size={20} stroke={3} color={c} track={track} /> : <Ionicons name="flag-outline" size={18} color={c} />}
                        <Text style={[styles.msCount, { color: theme.textTertiary }]}>{m.doneCount}/{m.stepCount}</Text>
                      </View>
                      <Text style={[styles.msTitle, { color: m.state === 'future' ? theme.textSecondary : theme.textPrimary }]} numberOfLines={2}>{m.title || m.name}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <SectionTitle theme={theme} title={msFilter ? `Steps · ${(ms.find((m) => m.id === msFilter) || {}).title || 'Milestone'}` : 'Steps'} />
          {tree.map((node, i) => (
            <StepNode key={node.step.id} node={node} last={i === tree.length - 1} theme={theme} now={now} track={track}
              open={!!expanded[node.step.id]} onToggle={() => { haptic.select(); setExpanded((e) => ({ ...e, [node.step.id]: !e[node.step.id] })); }}
              onPress={(s) => { haptic.light(); setDetailStep(s); }} browserFrame={browserFrame} onOpenBrowser={onOpenBrowser} />
          ))}
          {tree.length === 0 ? <Text style={{ color: theme.textTertiary, textAlign: 'center', marginTop: 20 }}>No steps yet.</Text> : null}
        </View>
      </Animated.ScrollView>

      <FrostedBar theme={theme} style={[styles.bar, { borderBottomColor: theme.separator }]}>
        <CircleButton theme={theme} icon="chevron-back" label="All plans" onPress={() => onOpenPlan?.(null)} />
        <Animated.View style={[styles.barCenter, { opacity: barTitleOpacity }]}>
          <Text style={[styles.barTitle, { color: theme.textPrimary }]} numberOfLines={1}>{plan.goal}</Text>
          <Text style={[styles.barSub, { color: sc }]}>{prog.done}/{prog.total} · {label}</Text>
        </Animated.View>
        <CircleButton theme={theme} icon="chatbubble-outline" label="Back to chat" onPress={onClose} iconSize={20} />
      </FrostedBar>

      <Dock theme={theme} dock={dock} plan={plan} insets={insets} onStartPlan={onStartPlan} onCancelPlan={onCancelPlan}
        onApproveStep={onApproveStep} onRejectStep={onRejectStep} onAcceptCheckpoint={onAcceptCheckpoint} onDismissCheckpoint={onDismissCheckpoint} />

      {celebrate ? <Completion theme={theme} plan={plan} onDone={() => setCelebrate(false)} /> : null}
      <StepDetailSheet step={sheetStep} visible={!!sheetStep} onClose={() => setDetailStep(null)} theme={theme} />
    </View>
  );
}

function SectionTitle({ theme, title, right, onRight }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      {right ? <TouchableOpacity onPress={onRight}><Text style={{ color: theme.brandStrong, fontSize: 15 }}>{right}</Text></TouchableOpacity> : null}
    </View>
  );
}

function StepNode({ node, last, theme, now, track, open, onToggle, onPress, browserFrame, onOpenBrowser }) {
  const { step, children } = node;
  const running = step.status === 'running' || step.status === 'recovering';
  const failed = step.status === 'failed';
  const dur = stepDuration(step, now);
  const lineColor = step.status === 'done' ? statusColor(theme, 'done') : theme.separator;
  return (
    <View style={styles.stepRow}>
      <View style={styles.rail}>
        <View style={styles.railDot}><StatusGlyph status={step.status} theme={theme} size={24} /></View>
        {!last ? <View style={[styles.railLine, { backgroundColor: lineColor }]} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(step)} accessibilityRole="button"
          style={[styles.stepCard, glassSurface(theme, 18), running && { borderColor: `${statusColor(theme, 'running')}66` }, failed && { borderColor: `${statusColor(theme, 'failed')}66` }]}>
          <GlassFill theme={theme} radius={18} />
          {running ? <RowShimmer color={statusColor(theme, 'running')} radius={18} /> : null}
          <View style={styles.stepTop}>
            <AppIconTile k={step.domain} size={30} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.stepTitle, { color: step.status === 'pending' || step.status === 'blocked' ? theme.textSecondary : theme.textPrimary }]} numberOfLines={3}>{step.description}</Text>
              <View style={styles.stepMeta}>
                <Text style={[styles.stepMetaText, { color: theme.textTertiary }]}>{iconFor(step.domain).label}</Text>
                {dur != null ? <Text style={[styles.stepMetaText, { color: theme.textTertiary }]}>· {formatDuration(dur)}</Text> : null}
                {step.retry_count > 0 ? <Text style={[styles.stepMetaText, { color: theme.textTertiary }]}>· retried {step.retry_count}×</Text> : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </View>
          {step.is_risky || step.status === 'awaiting_approval' ? (
            <View style={styles.chips}>
              <Capsule theme={theme} icon="shield-half" label={step.status === 'awaiting_approval' ? 'Needs approval' : 'Risky'} color={statusColor(theme, 'awaiting_approval')} />
              {step.status === 'blocked' ? <Capsule theme={theme} icon="lock-closed" label="Blocked" color={theme.textTertiary} /> : null}
            </View>
          ) : null}
          {failed && step.error_message ? (
            <TouchableOpacity onPress={onToggle} style={[styles.err, { backgroundColor: `${statusColor(theme, 'failed')}14` }]}>
              <Ionicons name="alert-circle" size={15} color={statusColor(theme, 'failed')} />
              <Text style={[styles.errText, { color: statusColor(theme, 'failed') }]} numberOfLines={open ? undefined : 2}>{step.error_message}</Text>
            </TouchableOpacity>
          ) : null}
          {step.domain === 'browser' && running && browserFrame ? (
            <TouchableOpacity onPress={onOpenBrowser} style={styles.thumbWrap} accessibilityLabel="Open live browser">
              <Image source={{ uri: `data:image/jpeg;base64,${browserFrame}` }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.thumbBadge}><LiveLight color="#FF3B30" pulse size={6} /><Text style={styles.thumbText}>LIVE · Open browser</Text></View>
            </TouchableOpacity>
          ) : null}
          {children.length ? (
            <TouchableOpacity onPress={onToggle} style={styles.subToggle} accessibilityRole="button">
              <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={14} color={theme.textSecondary} />
              <Text style={[styles.subToggleText, { color: theme.textSecondary }]}>{children.filter((c) => c.status === 'done').length}/{children.length} sub-tasks</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {open && children.length ? children.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => onPress(c)} style={[styles.sub, { borderLeftColor: theme.separator }]}>
            <StatusGlyph status={c.status} theme={theme} size={18} />
            <AppIconTile k={c.domain} size={22} />
            <Text style={[styles.subText, { color: theme.textPrimary }]} numberOfLines={2}>{c.description}</Text>
          </TouchableOpacity>
        )) : null}
      </View>
    </View>
  );
}

function Dock({ theme, dock, plan, insets, onStartPlan, onCancelPlan, onApproveStep, onRejectStep, onAcceptCheckpoint, onDismissCheckpoint }) {
  if (dock.kind === 'none' || dock.kind === 'terminal') return null;
  const cpId = plan.checkpoint_plan_id || plan.id;
  let body = null;
  if (dock.kind === 'start') {
    body = (<>
      <DockInfo theme={theme} icon="play-circle" color={theme.brandStrong} title="Ready when you are" text={`${(plan.steps || []).length} steps planned. Review them, then start.`} />
      <View style={styles.dockBtns}>
        <DenyButton theme={theme} label="Cancel" style={styles.flex} onPress={() => { haptic.light(); onCancelPlan?.(plan.id); }} />
        <AllowButton label="Start plan" icon="play" style={styles.flex} onPress={() => { haptic.medium(); onStartPlan?.(plan.id); }} />
      </View>
    </>);
  } else if (dock.kind === 'approval') {
    const s = dock.step;
    body = (<>
      <View style={styles.dockInfo}>
        <AppIconTile k={s.domain} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.hRow}><Ionicons name="warning" size={14} color={statusColor(theme, 'awaiting_approval')} /><Text style={[styles.dockKicker, { color: statusColor(theme, 'awaiting_approval') }]}>NEEDS YOUR APPROVAL</Text></View>
          <Text style={[styles.dockTitle, { color: theme.textPrimary }]} numberOfLines={2}>{s.description}</Text>
          <Text style={[styles.dockText, { color: theme.textSecondary }]} numberOfLines={3}>{s.risk_reason || 'This step needs your approval before it runs.'}</Text>
        </View>
      </View>
      <View style={styles.dockBtns}>
        <DenyButton theme={theme} style={styles.flex} onPress={() => { haptic.warning(); onRejectStep?.(s, s.plan_id || plan.id); }} />
        <AllowButton icon="checkmark" style={styles.flex} onPress={() => { haptic.success(); onApproveStep?.(s, s.plan_id || plan.id); }} />
      </View>
    </>);
  } else if (dock.kind === 'checkpoint') {
    body = (<>
      <DockInfo theme={theme} icon="flag" color={statusColor(theme, 'done')} title="Checkpoint suggested" text={plan.checkpoint_reason || 'A good amount has changed since the last checkpoint - worth verifying before continuing.'} />
      <View style={styles.dockBtns}>
        <DenyButton theme={theme} label="Continue" style={styles.flex} onPress={() => { haptic.light(); onDismissCheckpoint?.(cpId); }} />
        <AllowButton label="Mark checkpoint" icon="flag" style={styles.flex} onPress={() => { haptic.success(); onAcceptCheckpoint?.(cpId); }} />
      </View>
    </>);
  } else if (dock.kind === 'running') {
    const s = dock.step;
    body = (
      <View style={styles.dockInfo}>
        {s ? <AppIconTile k={s.domain} size={32} /> : <ActivityIndicator color={statusColor(theme, 'running')} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.hRow}><LiveLight color={statusColor(theme, 'running')} pulse size={7} /><Text style={[styles.dockKicker, { color: statusColor(theme, 'running') }]}>{plan.status === 'recovering' ? 'RECOVERING' : plan.status === 'planning' ? 'PLANNING' : 'WORKING'}</Text></View>
          <FadeSwapText text={s ? s.description : 'Preparing the next step…'} style={[styles.dockTitle, { color: theme.textPrimary }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.dock, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={[styles.dockGlass, glassSurface(theme, 26)]}><GlassFill theme={theme} radius={26} strong />{body}</View>
    </View>
  );
}

function DockInfo({ theme, icon, color, title, text }) {
  return (
    <View style={styles.dockInfo}>
      <View style={[styles.dockIcon, { backgroundColor: `${color}1F` }]}><Ionicons name={icon} size={22} color={color} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.dockTitle, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[styles.dockText, { color: theme.textSecondary }]} numberOfLines={3}>{text}</Text>
      </View>
    </View>
  );
}

function Completion({ theme, plan, onDone }) {
  const rm = useReduceMotion();
  const s = useRef(new Animated.Value(rm ? 1 : 0)).current;
  const sum = completionSummary(plan);
  useEffect(() => { if (!rm) Animated.spring(s, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start(); }, [rm, s]);
  const ok = statusColor(theme, 'done');
  return (
    <View style={styles.celebrate}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onDone} />
      <Animated.View style={[styles.celebCard, glassSurface(theme, 30), { opacity: s, transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <GlassFill theme={theme} radius={30} strong />
        <Animated.View style={[styles.celebRing, { backgroundColor: `${ok}22`, transform: [{ scale: s }] }]}><Ionicons name="checkmark-circle" size={72} color={ok} /></Animated.View>
        <Text style={[styles.celebTitle, { color: theme.textPrimary }]}>Plan complete</Text>
        <Text style={[styles.celebGoal, { color: theme.textSecondary }]} numberOfLines={3}>{plan.goal}</Text>
        <View style={styles.celebStats}>
          <Stat theme={theme} v={`${sum.done}/${sum.total}`} k="Steps done" />
          <Stat theme={theme} v={String(sum.calls)} k="Tool calls" />
          <Stat theme={theme} v={sum.elapsed || '—'} k="Elapsed" />
        </View>
        {sum.skipped ? <Text style={[styles.dockText, { color: theme.textTertiary, textAlign: 'center' }]}>{sum.skipped} skipped</Text> : null}
        <AllowButton label="Done" style={{ alignSelf: 'stretch', marginTop: 8 }} onPress={() => { haptic.light(); onDone(); }} />
      </Animated.View>
    </View>
  );
}
const Stat = ({ theme, v, k }) => (<View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700' }}>{v}</Text><Text style={{ color: theme.textTertiary, fontSize: 12 }}>{k}</Text></View>);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missing: { fontSize: 15, marginTop: 10, textAlign: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 56, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  barCenter: { flex: 1, alignItems: 'center' },
  barTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  barSub: { fontSize: 12, fontWeight: '500' },
  hero: { padding: 18, marginTop: 8, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringPct: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  ringSub: { fontSize: 12, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 10, paddingLeft: 4, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 13, fontWeight: '600' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, letterSpacing: -0.08 },
  goal: { fontSize: 26, fontWeight: '700', letterSpacing: 0.3, lineHeight: 31 },
  stop: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17 },
  stopText: { fontSize: 15, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginHorizontal: 4 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: -0.08 },
  msItem: { flexDirection: 'row', alignItems: 'center' },
  msLine: { width: 14, height: 2, borderRadius: 1 },
  msCard: { width: 140, padding: 12, gap: 8 },
  msHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msCount: { fontSize: 12, fontWeight: '600' },
  msTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.15, lineHeight: 18 },
  stepRow: { flexDirection: 'row', gap: 10 },
  rail: { width: 26, alignItems: 'center' },
  railDot: { height: 50, justifyContent: 'center' },
  railLine: { flex: 1, width: 2, borderRadius: 1, marginTop: -8, marginBottom: -12 },
  stepCard: { padding: 12, gap: 10, overflow: 'hidden' },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3, lineHeight: 21 },
  stepMeta: { flexDirection: 'row', gap: 4, marginTop: 2 },
  stepMetaText: { fontSize: 13 },
  chips: { flexDirection: 'row', gap: 6, marginLeft: 42 },
  err: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: 12 },
  errText: { flex: 1, fontSize: 13, lineHeight: 18 },
  thumbWrap: { borderRadius: 12, overflow: 'hidden', height: 110 },
  thumb: { width: '100%', height: '100%' },
  thumbBadge: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', paddingRight: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)' },
  thumbText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  subToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 42 },
  subToggleText: { fontSize: 13, fontWeight: '500' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16, paddingLeft: 12, paddingVertical: 8, borderLeftWidth: 2 },
  subText: { flex: 1, fontSize: 14 },
  dock: { position: 'absolute', left: 12, right: 12 },
  dockGlass: { padding: 14, gap: 12 },
  dockInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dockIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dockKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  dockTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3, marginTop: 1 },
  dockText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  dockBtns: { flexDirection: 'row', gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  celebrate: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  celebCard: { alignSelf: 'stretch', padding: 22, alignItems: 'center', gap: 10 },
  celebRing: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  celebTitle: { fontSize: 24, fontWeight: '700' },
  celebGoal: { fontSize: 15, textAlign: 'center' },
  celebStats: { flexDirection: 'row', alignSelf: 'stretch', marginVertical: 8 },
});
