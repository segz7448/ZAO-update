import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';
import { CountryFlag } from '../../ui/flags';
import { haptic } from '../../ui/ios';
import { vpn, VPN_MAX } from '../../vpn';

function formatBytes(n) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatBps(n) {
  if (n == null) return '—';
  return `${formatBytes(n)}/s`;
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
}

function Gauge({ theme, label, percent, tone }) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent ?? 0)) / 100;
  const color = tone === 'bad' ? theme.dangerText : tone === 'warn' ? (theme.warning || '#FF9F0A') : theme.success;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.borderStrong} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 16 }}>
            {percent == null ? '—' : `${percent}%`}
          </Text>
        </View>
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function TrustPanel({ theme, reputation }) {
  if (!reputation) return null;
  const cleanTone = reputation.cleanPercent < 50 ? 'bad' : reputation.cleanPercent < 70 ? 'warn' : 'ok';
  const transTone = reputation.transparencyPercent == null
    ? 'neutral'
    : reputation.transparencyPercent < 50 ? 'bad' : reputation.transparencyPercent < 70 ? 'warn' : 'ok';
  return (
    <GlassCard theme={theme}>
      <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Trust</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Gauge
          theme={theme}
          label="IP Reputation / Transparency"
          percent={reputation.transparencyPercent}
          tone={transTone === 'neutral' ? 'warn' : transTone}
        />
        <Gauge theme={theme} label="Clean %" percent={reputation.cleanPercent} tone={cleanTone} />
      </View>
      {reputation.transparencyStatus === 'needs_provider' ? (
        <Text style={{ color: theme.textTertiary, fontSize: 12, marginBottom: 10 }}>
          Transparency needs provider metadata.
        </Text>
      ) : null}
      {(reputation.dnsbl || []).map((d) => (
        <View key={d.id} style={styles.dnsblRow}>
          <Text style={{ color: theme.textPrimary, flex: 1, fontSize: 14 }}>{d.label}</Text>
          <StatusPill
            theme={theme}
            tone={d.status === 'clean' ? 'ok' : d.status === 'listed' ? 'bad' : 'warn'}
            label={d.status === 'clean' ? 'Clean' : d.status === 'listed' ? 'Listed' : 'Error'}
          />
        </View>
      ))}
      {reputation.suggestion ? (
        <View style={[styles.warnBox, { backgroundColor: theme.warningSoft || theme.accentSoft, borderColor: theme.warning || theme.accent }]}>
          <Ionicons name="warning" size={18} color={theme.warning || theme.accent} />
          <Text style={{ color: theme.textPrimary, flex: 1, fontSize: 13, marginLeft: 8, lineHeight: 18 }}>
            Trust is low. {reputation.suggestion}
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

function ActiveCard({ theme, active, usage, reputation, onOpen }) {
  if (!active) {
    return (
      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIconTile k="vpn" size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>No active VPN</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 4, lineHeight: 18 }}>
              Buy a dedicated IP bound to the agent computer. All browser and fetch traffic routes through it.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <StatusPill theme={theme} tone="neutral" label="Not connected" />
        </View>
      </GlassCard>
    );
  }
  const left = daysLeft(active.expiresAt);
  const trustTone = reputation?.trustTone || 'ok';
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.88}>
      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CountryFlag code={active.countryCode} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>
              {active.city}, {active.region}
            </Text>
            <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{active.country}</Text>
          </View>
          <StatusPill theme={theme} tone="ok" label="Connected" />
        </View>
        <View style={styles.metaGrid}>
          <Meta theme={theme} label="IP" value={active.ip} />
          <Meta theme={theme} label="Protocol" value={active.protocol || 'HTTP'} />
          <Meta theme={theme} label="Expires" value={left != null ? `${left}d left` : '—'} />
          <Meta theme={theme} label="Renew by" value={active.renewBy ? new Date(active.renewBy).toLocaleDateString() : '—'} />
        </View>
        {usage ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Live usage</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatusPill theme={theme} tone="info" label={`↓ ${formatBps(usage.downBps)}`} />
              <StatusPill theme={theme} tone="info" label={`↑ ${formatBps(usage.upBps)}`} />
            </View>
            <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 8 }}>
              {formatBytes(usage.usedBytes)} / {formatBytes(usage.quotaBytes)} used
            </Text>
            <View style={[styles.quotaBar, { backgroundColor: theme.surfaceAlt }]}>
              <View style={{
                width: `${Math.min(100, (usage.usedBytes / Math.max(1, usage.quotaBytes)) * 100)}%`,
                backgroundColor: theme.accent, height: '100%', borderRadius: 4,
              }} />
            </View>
          </View>
        ) : null}
        {trustTone !== 'ok' ? (
          <View style={{ marginTop: 10 }}>
            <StatusPill theme={theme} tone={trustTone === 'bad' ? 'bad' : 'warn'} label={`Trust ${reputation?.trustPercent ?? '—'}%`} />
          </View>
        ) : null}
      </GlassCard>
    </TouchableOpacity>
  );
}

function Meta({ theme, label, value }) {
  return (
    <View style={{ width: '48%', marginBottom: 8 }}>
      <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function BuyFlow({ theme, count, onDone, onCancel }) {
  const [step, setStep] = useState('country'); // country | region | confirm
  const [locations, setLocations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [country, setCountry] = useState(null);
  const [regionId, setRegionId] = useState(null);
  const [planId, setPlanId] = useState('30d');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [loc, pl] = await Promise.all([vpn.locations(), vpn.plans()]);
      setLocations(loc.data || []);
      setPlans(pl.data || []);
    })();
  }, []);

  useEffect(() => {
    if (!regionId || !planId) return;
    vpn.quote({ regionId, planId }).then((r) => setQuote(r.data || null));
  }, [regionId, planId]);

  const purchase = async () => {
    if (count >= VPN_MAX) {
      Alert.alert('Limit reached', `You can own at most ${VPN_MAX} VPNs.`);
      return;
    }
    setBusy(true);
    const r = await vpn.purchase({ regionId, planId });
    setBusy(false);
    if (!r.success) {
      Alert.alert('Purchase failed', r.error || 'Unknown error');
      return;
    }
    haptic.success();
    Alert.alert('Demo purchase', r.charge?.label || 'Demo · no real charge');
    onDone();
  };

  return (
    <View>
      <TouchableOpacity onPress={onCancel} style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={18} color={theme.info} />
        <Text style={{ color: theme.info, fontWeight: '600' }}>My VPNs</Text>
      </TouchableOpacity>

      <GlassCard theme={theme}>
        <StatusPill theme={theme} tone="info" label="Demo provider: no real charge" />
        <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 10 }}>Buy VPN</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
          Dedicated IP for the agent computer · {count} of {VPN_MAX}
        </Text>
      </GlassCard>

      {step === 'country' && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Country</Text>
          {locations.map((c) => (
            <TouchableOpacity
              key={c.countryCode}
              onPress={() => { haptic.select(); setCountry(c); setStep('region'); }}
              style={{ marginBottom: 8 }}
            >
              <GlassCard theme={theme}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <CountryFlag code={c.countryCode} size={28} />
                  <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 16, flex: 1 }}>{c.country}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.chevron} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </>
      )}

      {step === 'region' && country && (
        <>
          <TouchableOpacity onPress={() => setStep('country')} style={{ marginBottom: 8 }}>
            <Text style={{ color: theme.info, fontWeight: '600' }}>← {country.country}</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>State / region</Text>
          {country.regions.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => { haptic.select(); setRegionId(r.id); setStep('confirm'); }}
              style={{ marginBottom: 8 }}
            >
              <GlassCard theme={theme}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{r.name}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{r.city}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </>
      )}

      {step === 'confirm' && (
        <>
          <TouchableOpacity onPress={() => setStep('region')} style={{ marginBottom: 8 }}>
            <Text style={{ color: theme.info, fontWeight: '600' }}>← Change region</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Plan duration</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {plans.map((p) => {
              const on = planId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => { haptic.select(); setPlanId(p.id); }}
                  style={[styles.planChip, {
                    backgroundColor: on ? theme.accentSoft : theme.surfaceAlt,
                    borderColor: on ? theme.accent : theme.border,
                  }]}
                >
                  <Text style={{ color: on ? theme.accent : theme.textPrimary, fontWeight: '700' }}>{p.label}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                    ${p.demoPriceUsd.toFixed(2)} · Demo
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <GlassCard theme={theme}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 17 }}>Confirmation</Text>
            {quote ? (
              <>
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{quote.label}</Text>
                <Text style={{ color: theme.textPrimary, fontSize: 28, fontWeight: '800', marginTop: 10 }}>
                  ${Number(quote.amountUsd).toFixed(2)}
                </Text>
                <Text style={{ color: theme.textTertiary, marginTop: 4 }}>Demo · no real charge</Text>
              </>
            ) : <ActivityIndicator color={theme.accent} />}
          </GlassCard>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}
            onPress={purchase}
            disabled={busy || count >= VPN_MAX}
          >
            <Text style={{ color: theme.textInverse, fontWeight: '700' }}>
              {count >= VPN_MAX ? `Limit ${VPN_MAX} reached` : 'Purchase · Demo'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function DetailView({ theme, item, reputation, usage, isActive, providerLabel, onBack, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(!!isActive);
  const trust = reputation?.trustPercent ?? null;
  const tone = reputation?.trustTone || 'ok';
  const left = daysLeft(item.expiresAt);
  const renewBy = item.renewBy ? new Date(item.renewBy) : null;
  const expires = item.expiresAt ? new Date(item.expiresAt) : null;

  useEffect(() => { setRouting(!!isActive); }, [isActive, item?.id]);

  const act = async (fn, label) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r?.success) Alert.alert(label, r?.error || 'Failed');
    else { haptic.success(); await onChanged?.(); }
    return r;
  };

  const toggleRoute = async (next) => {
    setRouting(next);
    if (next) {
      const r = await act(() => vpn.activate(item.id), 'Route agent');
      if (!r?.success) setRouting(false);
    } else {
      Alert.alert(
        'Stop routing?',
        'Agent traffic will leave this VPN until you route again.',
        [
          { text: 'Keep routing', style: 'cancel', onPress: () => setRouting(true) },
          { text: 'Stop', style: 'destructive', onPress: async () => {
            // Demo: activating another is preferred; deactivate leaves none active.
            const r = await act(() => vpn.deactivate(), 'Stop routing');
            if (!r?.success) setRouting(true);
          } },
        ]
      );
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={18} color={theme.info} />
        <Text style={{ color: theme.info, fontWeight: '600' }}>My VPNs</Text>
      </TouchableOpacity>

      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CountryFlag code={item.countryCode} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700' }}>
              {item.countryCode} · {item.city}
            </Text>
            <Text style={{ color: theme.textSecondary }}>{item.region} · {item.country}</Text>
            <Text style={{ color: theme.textTertiary, marginTop: 4 }}>{item.ip} · {item.protocol}</Text>
          </View>
          <StatusPill theme={theme} tone={routing ? 'ok' : 'neutral'} label={routing ? 'Routing' : 'Ready'} />
        </View>
        {tone !== 'ok' ? (
          <View style={{ marginTop: 10 }}>
            <StatusPill theme={theme} tone={tone === 'bad' ? 'bad' : 'warn'} label={`Trust ${trust}%`} />
          </View>
        ) : null}
        <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 10, fontWeight: '600' }}>
          {providerLabel || 'Demo provider: no real charge'}
        </Text>
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Live usage</Text>
      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatusPill theme={theme} tone="info" label={`↓ ${formatBps(usage?.downBps)}`} />
          <StatusPill theme={theme} tone="info" label={`↑ ${formatBps(usage?.upBps)}`} />
        </View>
        <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>
          {formatBytes(usage?.usedBytes)} / {formatBytes(usage?.quotaBytes)} used
        </Text>
        <View style={[styles.quotaBar, { backgroundColor: theme.surfaceAlt, marginTop: 8 }]}>
          <View style={{
            width: `${Math.min(100, ((usage?.usedBytes || 0) / Math.max(1, usage?.quotaBytes || 1)) * 100)}%`,
            backgroundColor: theme.accent, height: '100%', borderRadius: 4,
          }} />
        </View>
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Expiry</Text>
      <GlassCard theme={theme}>
        <View style={styles.metaGrid}>
          <Meta theme={theme} label="Expires" value={expires ? expires.toLocaleDateString() : '—'} />
          <Meta theme={theme} label="Countdown" value={left != null ? `${left} day${left === 1 ? '' : 's'}` : '—'} />
          <Meta theme={theme} label="Renew by" value={renewBy ? renewBy.toLocaleDateString() : '—'} />
          <Meta theme={theme} label="Plan" value={item.planLabel || item.planId || '30 days'} />
        </View>
        {left != null && left <= 7 ? (
          <Text style={{ color: theme.warning || theme.accent, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
            Renew by {renewBy ? renewBy.toLocaleDateString() : 'soon'} to keep this IP.
          </Text>
        ) : null}
      </GlassCard>

      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="navigate" size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>Route agent through this VPN</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
              Browser and fetch traffic on the agent computer use this dedicated IP.
            </Text>
          </View>
          <Switch
            value={routing}
            onValueChange={(v) => { haptic.light(); toggleRoute(v); }}
            trackColor={{ false: theme.surfaceAlt, true: theme.accentSoft || theme.accent }}
            thumbColor={routing ? theme.accent : theme.textTertiary}
          />
        </View>
      </GlassCard>

      <TrustPanel theme={theme} reputation={reputation} />

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Actions</Text>
      <GlassCard theme={theme}>
        <ActionRow theme={theme} icon="calendar" label="Renew" sub="Extend plan · demo pricing" onPress={() => act(() => vpn.renew(item.id, '30d'), 'Renew')} />
        <ActionRow theme={theme} icon="swap-horizontal" label="Change" sub="Move to another country or state" onPress={() => {
          Alert.alert('Change location', 'Pick a new region', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'California', onPress: () => act(() => vpn.change(item.id, 'us-ca'), 'Change') },
            { text: 'London', onPress: () => act(() => vpn.change(item.id, 'gb-eng'), 'Change') },
            { text: 'Tokyo', onPress: () => act(() => vpn.change(item.id, 'jp-tyo'), 'Change') },
          ]);
        }} />
        <ActionRow
          theme={theme}
          icon="refresh"
          label="Release"
          sub="Replace a blacklisted or low-trust IP in the same region"
          onPress={() => {
            Alert.alert(
              'Release this IP?',
              'Gives up a blacklisted or degraded IP and replaces it (or refunds per provider). Demo mode replaces the IP in the same region.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Release', onPress: () => act(() => vpn.release(item.id), 'Release') },
              ]
            );
          }}
        />
        <ActionRow
          theme={theme}
          icon="trash"
          label="Delete"
          danger
          sub="Remove this VPN permanently"
          onPress={() => {
            Alert.alert('Delete VPN?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                await act(() => vpn.remove(item.id), 'Delete');
                onBack();
              } },
            ]);
          }}
        />
      </GlassCard>
      {busy ? <ActivityIndicator color={theme.accent} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

function ActionRow({ theme, icon, label, sub, onPress, danger }) {
  return (
    <TouchableOpacity onPress={() => { haptic.light(); onPress?.(); }} style={styles.actionRow}>
      <Ionicons name={icon} size={20} color={danger ? theme.dangerText : theme.accent} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: danger ? theme.dangerText : theme.textPrimary, fontWeight: '600', fontSize: 16 }}>{label}</Text>
        {sub ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.chevron} />
    </TouchableOpacity>
  );
}

export function VpnSheet({ visible, onClose, theme }) {
  const [view, setView] = useState('home'); // home | buy | detail
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [usage, setUsage] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [st, list] = await Promise.all([vpn.status(), vpn.list()]);
    setStatus(st.data || null);
    setItems(list.data?.items || []);
    setActiveId(list.data?.activeId || st.data?.active?.id || null);
    setReputation(st.data?.reputation || null);
    const active = st.data?.active;
    if (active?.id) {
      const u = await vpn.usage(active.id);
      setUsage(u.data || null);
    } else setUsage(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    refresh();
    const id = setInterval(async () => {
      const active = (await vpn.status()).data?.active;
      if (active?.id) {
        const u = await vpn.usage(active.id);
        setUsage(u.data || null);
        const st = await vpn.status();
        setReputation(st.data?.reputation || null);
        setStatus(st.data || null);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const openDetail = async (item) => {
    setSelected(item);
    setView('detail');
    const [r, u] = await Promise.all([vpn.reputation(item.id), vpn.usage(item.id)]);
    if (r.data) setReputation(r.data);
    else {
      const st = await vpn.status();
      if (st.data?.active?.id === item.id) setReputation(st.data.reputation);
    }
    if (u.data) setUsage(u.data);
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} title="VPN">
      {view === 'buy' ? (
        <BuyFlow
          theme={theme}
          count={items.length}
          onCancel={() => setView('home')}
          onDone={async () => { setView('home'); await refresh(); }}
        />
      ) : view === 'detail' && selected ? (
        <DetailView
          theme={theme}
          item={selected}
          reputation={reputation}
          usage={usage}
          isActive={selected?.id === activeId}
          providerLabel={status?.provider?.label}
          onBack={() => { setView('home'); setSelected(null); refresh(); }}
          onChanged={refresh}
        />
      ) : (
        <View>
          <ActiveCard
            theme={theme}
            active={status?.active}
            usage={usage}
            reputation={reputation}
            onOpen={() => status?.active && openDetail(status.active)}
          />

          {status?.active ? <TrustPanel theme={theme} reputation={reputation} /> : null}

          <View style={styles.headerRow}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 0 }]}>
              My VPNs · {items.length} of {VPN_MAX}
            </Text>
            <TouchableOpacity
              onPress={() => { haptic.light(); setView('buy'); }}
              style={[styles.addBtn, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
            >
              <Ionicons name="add" size={18} color={theme.accent} />
              <Text style={{ color: theme.accent, fontWeight: '700', marginLeft: 4 }}>Buy</Text>
            </TouchableOpacity>
          </View>

          {loading && !items.length ? <ActivityIndicator color={theme.accent} /> : null}

          {items.map((it) => {
            const on = it.id === activeId;
            return (
              <TouchableOpacity key={it.id} onPress={() => openDetail(it)} style={{ marginBottom: 8 }}>
                <GlassCard theme={theme}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <CountryFlag code={it.countryCode} size={28} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{it.city}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{it.ip}</Text>
                    </View>
                    <StatusPill theme={theme} tone={on ? 'ok' : 'neutral'} label={on ? 'Active' : 'Ready'} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })}

          <GlassCard theme={theme}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }}>
              Provider: {status?.provider?.label || 'Demo provider: no real charge'}. Agent browser and web fetches route through the active VPN on the server. Real providers and payments are not configured.
            </Text>
          </GlassCard>
        </View>
      )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 8, marginBottom: 8, marginLeft: 4,
  },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  quotaBar: { height: 6, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  dnsblRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  warnBox: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, marginTop: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
  },
  planChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minWidth: '30%' },
  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});
