/**
 * ZAO - Plan tab. No planId -> Plans home. With planId -> Muse plan detail:
 * solid white/near-black sheet, status pill, ~20/600 title, activity line,
 * time, MAIN mono milestone sections, dashed timeline with outlined
 * check/X/spinner, gray step titles. Status only — no Stop/Delete menu.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, haptic, AllowButton, DenyButton } from '../ui/ios';
import { AppIconTile, iconFor } from '../ui/icons';
import { usePlanStore } from '../store/planStore';
import { useTheme } from '../theme/useTheme';
import { LiveLight, useReduceMotion, FadeSwapText } from '../components/browserFx';
import { StatusGlyph, statusColor, PLAN_STATUS_LABEL } from '../components/planFx';
import {
  TERMINAL, stepDuration, planElapsed, formatDuration,
  milestoneStates, stepTree, dockState, completionSummary, pickAutoOpen,
  displayGoal, isPlanStalled,
} from '../services/planning/planView';
import StepDetailSheet from './StepDetailSheet';
import PlanHome from './PlanHome';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const STEP_TITLE = '#5a5a5a';
const STEP_TITLE_DARK = '#A1A1A6';

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
    return <PlanHome theme={theme} onOpenPlan={(id) => onOpenPlan?.(id)} onBackToChat={props.onClose} />;
  }
  return <PlanDetail {...props} theme={theme} />;
}

function statusPillSpec(plan, theme, now, label) {
  const stalled = isPlanStalled(plan, now);
  if (stalled) return { label: 'Stalled', bg: theme.mode === 'dark' ? '#FF9F0A' : '#FF9500', fg: '#fff' };
  if (plan.status === 'completed') return { label: 'Done', bg: theme.mode === 'dark' ? '#30D158' : '#34C759', fg: '#fff' };
  if (plan.status === 'failed') return { label: 'Failed', bg: theme.mode === 'dark' ? '#FF453A' : '#FF3B30', fg: '#fff' };
  if (plan.status === 'cancelled') return { label: 'Cancelled', bg: theme.textTertiary, fg: '#fff' };
  if (['running', 'planning', 'recovering', 'awaiting_approval', 'paused'].includes(plan.status)) {
    return {
      label: label === 'Needs your approval' ? 'Needs you' : label === 'Checkpoint' ? 'Checkpoint' : label === 'Ready to start' ? 'Ready' : 'In progress',
      bg: theme.mode === 'dark' ? '#FFFFFF' : '#000000',
      fg: theme.mode === 'dark' ? '#000000' : '#FFFFFF',
    };
  }
  return { label: PLAN_STATUS_LABEL[plan.status] || plan.status, bg: theme.textTertiary, fg: '#fff' };
}

function formatClock(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  } catch (_) {
    return '';
  }
}

function PlanDetail({ theme, planId, onClose, onOpenPlan, onApproveStep, onRejectStep, onAcceptCheckpoint, onDismissCheckpoint, onStartPlan, onOpenBrowser, browserFrame }) {
  const insets = useSafeAreaInsets();
  const rm = useReduceMotion();
  const scrollRef = useRef(null);
  const stepY = useRef({});
  const { activePlan, isLoading, loadPlan, refreshActivePlan } = usePlanStore();
  const [detailStep, setDetailStep] = useState(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [celebrate, setCelebrate] = useState(false);

  const prevDone = useRef(new Set());
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

  const sheetStep = detailStep && plan ? (plan.steps || []).find((s) => s.id === detailStep.id) || detailStep : detailStep;

  // Track newly completed steps for check-in animation
  const newlyDone = useMemo(() => {
    const set = new Set();
    if (!plan) return set;
    for (const s of plan.steps || []) {
      if ((s.status === 'done' || s.status === 'completed') && !prevDone.current.has(s.id)) set.add(s.id);
    }
    return set;
  }, [plan?.steps, plan?.updated_at]);
  useEffect(() => {
    if (!plan) return;
    const next = new Set(prevDone.current);
    for (const s of plan.steps || []) {
      if (s.status === 'done' || s.status === 'completed') next.add(s.id);
    }
    prevDone.current = next;
  }, [plan?.steps, plan?.updated_at]);

  // Auto-scroll to current running step
  useEffect(() => {
    if (!plan || rm) return;
    const running = (plan.steps || []).find((s) => s.status === 'running' || s.status === 'recovering');
    if (!running) return;
    const y = stepY.current[running.id];
    if (y == null || !scrollRef.current) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 120), animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [plan?.steps?.map((s) => `${s.id}:${s.status}`).join('|'), rm]);

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {isLoading ? <ActivityIndicator size="large" color={theme.textSecondary} /> : (
          <>
            <Ionicons name="document-text-outline" size={40} color={theme.textTertiary} />
            <Text style={[styles.missing, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.2}>This plan isn’t on this phone anymore.</Text>
            <TouchableOpacity onPress={() => onOpenPlan?.(null)} style={{ marginTop: 14 }}>
              <Text style={{ color: theme.brandStrong, fontSize: 16 }} maxFontSizeMultiplier={1.2}>All plans</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const steps = plan.steps || [];
  const ms = milestoneStates(plan.milestones || [], steps);
  const dock = dockState(plan);
  const elapsed = planElapsed(plan, now);
  const label = dock.kind === 'approval' ? 'Needs your approval' : dock.kind === 'checkpoint' ? 'Checkpoint' : dock.kind === 'start' ? 'Ready to start' : PLAN_STATUS_LABEL[plan.status] || plan.status;
  const pill = statusPillSpec(plan, theme, now, label);
  const goal = displayGoal(plan);
  const activity = (() => {
    if (isPlanStalled(plan, now)) return 'No progress for over 30 minutes';
    if (dock.kind === 'approval' && dock.step) return dock.step.description;
    if (dock.kind === 'checkpoint') return plan.checkpoint_reason || 'Checkpoint suggested';
    if (dock.step) return dock.step.description;
    const running = steps.find((s) => s.status === 'running' || s.status === 'recovering');
    if (running) return running.description;
    if (plan.status === 'planning') return 'Planning the next steps…';
    if (plan.status === 'completed') return 'All steps finished';
    if (plan.status === 'failed') return 'Stopped with an error';
    return label;
  })();
  const clock = formatClock(plan.updated_at || plan.created_at) || (elapsed != null ? formatDuration(elapsed) : '');
  const sheetBg = theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');
  const stepTitleColor = theme.mode === 'dark' ? STEP_TITLE_DARK : STEP_TITLE;

  const sections = useMemo(() => {
    if (ms.length) {
      return ms.map((m) => ({
        key: m.id,
        title: (m.title || m.name || 'MAIN').toUpperCase(),
        nodes: stepTree(steps, m.id),
      })).filter((s) => s.nodes.length || true);
    }
    return [{ key: 'main', title: 'MAIN', nodes: stepTree(steps, null) }];
  }, [ms, steps]);

  const EARLIER_COUNT = 2;
  const flatDone = steps.filter((s) => s.status === 'done' || s.status === 'skipped');
  const hideEarlier = !showEarlier && flatDone.length > EARLIER_COUNT && sections.length === 1;


  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={[styles.sheet, { backgroundColor: sheetBg, paddingTop: insets.top + 8 }]}>
        <View style={[styles.topChrome, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={{ flex: 1 }} />
          <CircleButton theme={theme} icon="close" size={44} iconSize={20} label="Close plan" onPress={() => onOpenPlan?.(null)} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 + insets.bottom }}
          scrollEventThrottle={16}
        >
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            {live && !isPlanStalled(plan, now) ? <LiveLight color={pill.fg} pulse={!rm} size={5} /> : null}
            <Text style={[styles.pillText, { color: pill.fg }]} maxFontSizeMultiplier={1.2}>{pill.label}</Text>
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{goal}</Text>
          <Text style={[styles.activity, { color: theme.textPrimary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{activity}</Text>
          <Text style={[styles.time, { color: theme.textTertiary }]} maxFontSizeMultiplier={1.2}>{clock}</Text>
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />

          {hideEarlier ? (
            <TouchableOpacity onPress={() => { haptic.select(); setShowEarlier(true); }} style={styles.showEarlier} accessibilityRole="button">
              <Text style={[styles.showEarlierText, { color: theme.brandStrong || '#007AFF' }]} maxFontSizeMultiplier={1.2}>Show earlier steps</Text>
            </TouchableOpacity>
          ) : null}

          {sections.map((sec) => {
            let nodes = sec.nodes;
            if (hideEarlier && sec.key === 'main') {
              const skip = Math.max(0, flatDone.length - EARLIER_COUNT);
              let seen = 0;
              nodes = nodes.filter((n) => {
                if (n.step.status === 'done' || n.step.status === 'skipped') {
                  seen += 1;
                  return seen > skip;
                }
                return true;
              });
            }
            if (!nodes.length) return null;
            return (
              <View key={sec.key} style={{ marginTop: 8 }}>
                <Text style={[styles.monoSection, { color: theme.textSecondary }]} maxFontSizeMultiplier={1.2}>{sec.title}</Text>
                {nodes.map((node, i) => (
                  <MuseStep
                    key={node.step.id}
                    node={node}
                    last={i === nodes.length - 1}
                    theme={theme}
                    now={now}
                    titleColor={stepTitleColor}
                    animateIn={newlyDone.has(node.step.id)}
                    onLayout={(y) => { stepY.current[node.step.id] = y; }}
                    onPress={(s) => { haptic.light(); setDetailStep(s); }}
                    browserFrame={browserFrame}
                    onOpenBrowser={onOpenBrowser}
                  />
                ))}
              </View>
            );
          })}
          {steps.length === 0 ? <Text style={{ color: theme.textTertiary, textAlign: 'center', marginTop: 20 }} maxFontSizeMultiplier={1.2}>No steps yet.</Text> : null}
        </ScrollView>

      </View>

      <Dock theme={theme} dock={dock} plan={plan} insets={insets} onStartPlan={onStartPlan}
        onApproveStep={onApproveStep} onRejectStep={onRejectStep} onAcceptCheckpoint={onAcceptCheckpoint} onDismissCheckpoint={onDismissCheckpoint} />

      {celebrate ? <Completion theme={theme} plan={plan} onDone={() => setCelebrate(false)} /> : null}
      <StepDetailSheet step={sheetStep} visible={!!sheetStep} onClose={() => setDetailStep(null)} theme={theme} />

    </View>
  );
}

function MuseStep({ node, last, theme, now, titleColor, animateIn, onLayout, onPress, browserFrame, onOpenBrowser }) {
  const { step, children } = node;
  const running = step.status === 'running' || step.status === 'recovering';
  const failed = step.status === 'failed';
  const dur = stepDuration(step, now);
  const desc = step.reasoning || step.action || step.target || (failed && step.error_message) || iconFor(step.domain).label;
  return (
    <View
      style={styles.stepRow}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
    >
      <View style={styles.rail}>
        <StatusGlyph status={step.status} theme={theme} size={22} animateIn={animateIn} />
        {!last ? (
          <View style={styles.dashWrap}>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={[styles.dash, { backgroundColor: theme.separator }]} />
            ))}
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(step)}
        accessibilityRole="button"
        style={styles.stepBody}
      >
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12, flexShrink: 1 }}>
          <Text style={[styles.stepTitle, { color: titleColor }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>
            {step.description}
          </Text>
          <Text style={[styles.stepDesc, { color: theme.textTertiary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>
            {desc}{dur != null ? ` · ${formatDuration(dur)}` : ''}
          </Text>
          {step.domain === 'browser' && running && browserFrame ? (
            <TouchableOpacity onPress={onOpenBrowser} style={styles.thumbWrap} accessibilityLabel="Open live browser">
              <Image source={{ uri: `data:image/jpeg;base64,${browserFrame}` }} style={styles.thumb} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
          {children.length ? (
            <Text style={[styles.subHint, { color: theme.textTertiary }]} maxFontSizeMultiplier={1.2}>
              {children.filter((c) => c.status === 'done').length}/{children.length} sub-tasks
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} style={{ marginTop: 2 }} />
      </TouchableOpacity>
    </View>
  );
}

function Dock({ theme, dock, plan, insets, onStartPlan, onApproveStep, onRejectStep, onAcceptCheckpoint, onDismissCheckpoint }) {
  if (dock.kind === 'none' || dock.kind === 'terminal') return null;
  const cpId = plan.checkpoint_plan_id || plan.id;
  const sheetBg = theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');
  let body = null;
  if (dock.kind === 'start') {
    body = (<>
      <DockInfo theme={theme} icon="play-circle" color={theme.brandStrong} title="Ready when you are" text={`${(plan.steps || []).length} steps planned. Review them, then start.`} />
      <View style={styles.dockBtns}>
        <AllowButton label="Start plan" icon="play" style={styles.flex} onPress={() => { haptic.medium(); onStartPlan?.(plan.id); }} />
      </View>
    </>);
  } else if (dock.kind === 'approval') {
    const s = dock.step;
    body = (<>
      <View style={styles.dockInfo}>
        <AppIconTile k={s.domain} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.dockKicker, { color: statusColor(theme, 'awaiting_approval') }]} maxFontSizeMultiplier={1.2}>NEEDS YOUR APPROVAL</Text>
          <Text style={[styles.dockTitle, { color: theme.textPrimary }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{s.description}</Text>
          <Text style={[styles.dockText, { color: theme.textSecondary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{s.risk_reason || 'This step needs your approval before it runs.'}</Text>
        </View>
      </View>
      <View style={styles.dockBtns}>
        <DenyButton theme={theme} style={styles.flex} onPress={() => { haptic.warning(); onRejectStep?.(s, s.plan_id || plan.id); }} />
        <AllowButton icon="checkmark" style={styles.flex} onPress={() => { haptic.success(); onApproveStep?.(s, s.plan_id || plan.id); }} />
      </View>
    </>);
  } else if (dock.kind === 'checkpoint') {
    body = (<>
      <DockInfo theme={theme} icon="flag" color={statusColor(theme, 'done')} title="Checkpoint suggested" text={plan.checkpoint_reason || 'A good amount has changed since the last checkpoint — worth verifying before continuing.'} />
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
          <View style={styles.hRow}><LiveLight color={statusColor(theme, 'running')} pulse size={7} /><Text style={[styles.dockKicker, { color: statusColor(theme, 'running') }]} maxFontSizeMultiplier={1.2}>{plan.status === 'recovering' ? 'RECOVERING' : plan.status === 'planning' ? 'PLANNING' : 'WORKING'}</Text></View>
          <FadeSwapText text={s ? s.description : 'Preparing the next step…'} style={[styles.dockTitle, { color: theme.textPrimary }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.dock, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={[styles.dockCard, { backgroundColor: sheetBg, borderColor: theme.separator }]}>{body}</View>
    </View>
  );
}

function DockInfo({ theme, icon, color, title, text }) {
  return (
    <View style={styles.dockInfo}>
      <View style={[styles.dockIcon, { backgroundColor: `${color}1F` }]}><Ionicons name={icon} size={22} color={color} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.dockTitle, { color: theme.textPrimary }]} maxFontSizeMultiplier={1.2}>{title}</Text>
        <Text style={[styles.dockText, { color: theme.textSecondary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{text}</Text>
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
  const sheetBg = theme.card || (theme.mode === 'dark' ? '#1C1C1E' : '#FFFFFF');
  return (
    <View style={styles.celebrate}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onDone} />
      <Animated.View style={[styles.celebCard, { backgroundColor: sheetBg, opacity: s, transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <Animated.View style={[styles.celebRing, { backgroundColor: `${ok}22`, transform: [{ scale: s }] }]}><Ionicons name="checkmark-circle-outline" size={72} color={ok} /></Animated.View>
        <Text style={[styles.celebTitle, { color: theme.textPrimary }]} maxFontSizeMultiplier={1.2}>Plan complete</Text>
        <Text style={[styles.celebGoal, { color: theme.textSecondary }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>{displayGoal(plan)}</Text>
        <View style={styles.celebStats}>
          <Stat theme={theme} v={`${sum.done}/${sum.total}`} k="Steps done" />
          <Stat theme={theme} v={String(sum.calls)} k="Tool calls" />
          <Stat theme={theme} v={sum.elapsed || '—'} k="Elapsed" />
        </View>
        <AllowButton label="Done" style={{ alignSelf: 'stretch', marginTop: 8 }} onPress={() => { haptic.light(); onDone(); }} />
      </Animated.View>
    </View>
  );
}
const Stat = ({ theme, v, k }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700' }} maxFontSizeMultiplier={1.2}>{v}</Text>
    <Text style={{ color: theme.textTertiary, fontSize: 12 }} maxFontSizeMultiplier={1.2}>{k}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missing: { fontSize: 15, marginTop: 10, textAlign: 'center' },
  sheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  topChrome: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', zIndex: 5, gap: 0 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 24, borderRadius: 12, marginTop: 52, marginBottom: 10 },
  pillText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: 0.2, lineHeight: 26, marginBottom: 6, paddingRight: 96 },
  activity: { fontSize: 17, fontWeight: '400', letterSpacing: -0.41, lineHeight: 22, marginBottom: 4, paddingRight: 24 },
  time: { fontSize: 13, fontWeight: '400', letterSpacing: -0.08, marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, width: '100%', marginBottom: 12 },
  showEarlier: { paddingVertical: 6, marginBottom: 4 },
  showEarlierText: { fontSize: 15, fontWeight: '400' },
  monoSection: { fontSize: 15, fontWeight: '500', letterSpacing: 1.2, fontFamily: MONO, marginTop: 10, marginBottom: 12 },
  stepRow: { flexDirection: 'row', gap: 12, minHeight: 72, marginBottom: 4 },
  rail: { width: 22, alignItems: 'center' },
  dashWrap: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 4 },
  dash: { width: 1.5, height: 5, borderRadius: 1 },
  stepBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 20 },
  stepTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24, lineHeight: 20, flexShrink: 1 },
  stepDesc: { fontSize: 15, fontWeight: '400', letterSpacing: -0.24, lineHeight: 20, marginTop: 2, flexShrink: 1 },
  subHint: { fontSize: 13, marginTop: 6 },
  thumbWrap: { borderRadius: 10, overflow: 'hidden', height: 88, marginTop: 8 },
  thumb: { width: '100%', height: '100%' },
  dock: { position: 'absolute', left: 12, right: 12 },
  dockCard: { padding: 14, gap: 12, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  dockInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dockIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dockKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  dockTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.24, marginTop: 1 },
  dockText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  dockBtns: { flexDirection: 'row', gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  celebrate: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  celebCard: { alignSelf: 'stretch', padding: 22, alignItems: 'center', gap: 10, borderRadius: 28 },
  celebRing: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  celebTitle: { fontSize: 22, fontWeight: '700' },
  celebGoal: { fontSize: 15, textAlign: 'center' },
  celebStats: { flexDirection: 'row', alignSelf: 'stretch', marginVertical: 8 },
});
