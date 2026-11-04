import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, Linking,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';
import { haptic } from '../../ui/ios';
import {
  CONNECTORS, CONNECTOR_CATEGORIES, FEATURED_CONNECTOR_IDS, searchConnectors, connectorById,
} from '../../connectors/registry';
import {
  getGithubConnectionStatus,
  connectGithubWithToken,
  connectGithubWithDeviceFlow,
  disconnectGithub,
  GITHUB_DEVICE_VERIFY_URL,
  getGithubOAuthClientId,
  createIdleState,
} from '../../connectors/githubAccount';
import { copySecret } from '../../vault/clipboard';
import { usePreferencesStore } from '../../store/preferencesStore';

function CategoryChips({ theme, active, onChange }) {
  const chips = [{ id: 'all', label: 'All' }, ...CONNECTOR_CATEGORIES];
  return (
    <View style={styles.chips}>
      {chips.map((c) => {
        const on = active === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => { haptic.select(); onChange(c.id); }}
            style={[styles.chip, { backgroundColor: on ? theme.accentSoft : theme.surfaceAlt, borderColor: on ? theme.accent : theme.border }]}
          >
            <Text style={{ color: on ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ConnectorRow({ theme, connector, connected, onPress }) {
  const caps = (connector.capabilities || []).slice(0, 2);
  return (
    <TouchableOpacity
      style={[styles.connCard, { borderColor: theme.glassHighlight }]}
      onPress={() => { haptic.light(); onPress(connector); }}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <AppIconTile k={connector.icon} size={40} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{connector.name}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{connector.description}</Text>
        </View>
        <StatusPill
          theme={theme}
          tone={connected ? 'ok' : connector.wiring === 'live' ? 'neutral' : 'info'}
          label={connected ? 'Connected' : connector.wiring === 'live' ? 'Not connected' : 'Soon'}
        />
      </View>
      {caps.length ? (
        <View style={styles.capChips}>
          {caps.map((c) => (
            <View key={c} style={[styles.capChip, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.textTertiary, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function GithubDetail({ theme, status, onChanged, onClose }) {
  const [flow, setFlow] = useState(createIdleState());
  const [busy, setBusy] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const abortRef = useRef({ aborted: false });

  useEffect(() => () => { abortRef.current.aborted = true; }, []);

  const startOAuth = async () => {
    if (!getGithubOAuthClientId()) {
      setFlow({ ...createIdleState(), status: 'not_configured' });
      return;
    }
    setBusy(true);
    abortRef.current = { aborted: false };
    const result = await connectGithubWithDeviceFlow({
      signal: abortRef.current,
      onState: setFlow,
    });
    setBusy(false);
    if (result.success) {
      await onChanged?.();
      Alert.alert('Connected', `Signed in as ${result.data.login}`);
    } else if (result.state?.status !== 'denied' && result.state?.status !== 'expired' && result.state?.error !== 'aborted') {
      // keep state visible
    }
  };

  const savePat = async () => {
    setBusy(true);
    const result = await connectGithubWithToken(token, { username });
    setBusy(false);
    if (result.success) {
      setToken('');
      setShowPat(false);
      await onChanged?.();
      Alert.alert('Connected', `Authenticated as ${result.data.login}`);
    } else {
      Alert.alert('Connection failed', result.error?.message || 'Could not verify this token.');
    }
  };

  const doDisconnect = () => {
    Alert.alert('Disconnect GitHub?', 'ZAO will lose access to your repos until you connect again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          await disconnectGithub();
          await usePreferencesStore.getState().loadPreferences();
          await onChanged?.();
        },
      },
    ]);
  };

  if (status?.configured && status.account) {
    const a = status.account;
    return (
      <View>
        <GlassCard theme={theme}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {a.avatarUrl ? (
              <Image source={{ uri: a.avatarUrl }} style={styles.avatar} />
            ) : (
              <AppIconTile k="conn_github" size={56} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>{a.login || 'GitHub'}</Text>
              {a.name ? <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{a.name}</Text> : null}
              <StatusPill theme={theme} tone="ok" label="Connected" />
            </View>
          </View>
          {a.scopes?.length ? (
            <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 12 }}>
              Scopes · {a.scopes.join(', ')}
            </Text>
          ) : null}
          <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.dangerBorder, marginTop: 16 }]} onPress={doDisconnect}>
            <Text style={{ color: theme.dangerText, fontWeight: '700' }}>Disconnect</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  return (
    <View>
      <GlassCard theme={theme}>
        <AppIconTile k="conn_github" size={48} />
        <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 12 }}>GitHub</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 6, lineHeight: 20 }}>
          Repos, issues, pull requests, Actions, and commits under your account.
        </Text>
      </GlassCard>

      {flow.status === 'not_configured' || !getGithubOAuthClientId() ? (
        <GlassCard theme={theme}>
          <StatusPill theme={theme} tone="warn" label="Connector not configured yet" />
          <Text style={{ color: theme.textSecondary, marginTop: 10, lineHeight: 18 }}>
            Set expo.extra.githubOAuthClientId in app.json to enable GitHub OAuth Device Flow. You can still connect with a personal access token below.
          </Text>
        </GlassCard>
      ) : null}

      {(flow.status === 'awaiting_user' || flow.status === 'polling') && flow.userCode ? (
        <GlassCard theme={theme}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>Device code</Text>
          <Text style={[styles.deviceCode, { color: theme.textPrimary }]}>{flow.userCode}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
              onPress={async () => { await copySecret(flow.userCode, { clearAfterMs: 60_000 }); haptic.success(); }}
            >
              <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Copy code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.borderStrong }]}
              onPress={() => Linking.openURL(flow.verificationUri || GITHUB_DEVICE_VERIFY_URL)}
            >
              <Text style={{ color: theme.info, fontWeight: '700' }}>Open github.com/login/device</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <ActivityIndicator size="small" color={theme.info} />
            <Text style={{ color: theme.textSecondary }}>Waiting for authorization…</Text>
          </View>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={() => { abortRef.current.aborted = true; setFlow(createIdleState()); setBusy(false); }}>
            <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </GlassCard>
      ) : null}

      {flow.status === 'expired' || flow.status === 'denied' || flow.status === 'error' ? (
        <GlassCard theme={theme}>
          <StatusPill theme={theme} tone="bad" label={flow.status} />
          <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{flow.errorDescription || flow.error}</Text>
        </GlassCard>
      ) : null}

      {!(flow.status === 'awaiting_user' || flow.status === 'polling') && getGithubOAuthClientId() ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.accent, marginBottom: 12 }]}
          onPress={startOAuth}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={theme.textInverse} /> : <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Connect GitHub</Text>}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity onPress={() => setShowPat((v) => !v)} style={{ marginVertical: 8 }}>
        <Text style={{ color: theme.info, fontWeight: '600' }}>
          {showPat ? 'Hide advanced' : 'Advanced: use a token'}
        </Text>
      </TouchableOpacity>

      {showPat ? (
        <GlassCard theme={theme}>
          <TextInput
            style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]}
            placeholder="GitHub username"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]}
            placeholder="Personal access token (repo scope)"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            secureTextEntry
            value={token}
            onChangeText={setToken}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: (!token.trim() || busy) ? 0.5 : 1 }]}
            disabled={!token.trim() || busy}
            onPress={savePat}
          >
            {busy ? <ActivityIndicator color={theme.textInverse} /> : <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Test & Save</Text>}
          </TouchableOpacity>
        </GlassCard>
      ) : null}
    </View>
  );
}

function ComingSoonDetail({ theme, connector }) {
  return (
    <View>
      <GlassCard theme={theme}>
        <AppIconTile k={connector.icon} size={48} />
        <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 12 }}>{connector.name}</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 6, lineHeight: 20 }}>{connector.description}</Text>
        <View style={{ marginTop: 12 }}>
          <StatusPill theme={theme} tone="info" label="Coming soon" />
        </View>
      </GlassCard>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>What ZAO will be able to do</Text>
      <GlassCard theme={theme}>
        {connector.capabilities.map((cap, i) => (
          <View key={cap} style={[styles.capRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            <Text style={{ color: theme.textPrimary, flex: 1, marginLeft: 10 }}>{cap}</Text>
          </View>
        ))}
      </GlassCard>
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.fill }]} disabled>
        <Text style={{ color: theme.textTertiary, fontWeight: '700' }}>Connect · coming soon</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ConnectorsHub({ visible, onClose, theme }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [githubStatus, setGithubStatus] = useState(null);

  const refreshGithub = async () => {
    const s = await getGithubConnectionStatus();
    setGithubStatus(s);
    await usePreferencesStore.getState().loadPreferences();
  };

  useEffect(() => {
    if (visible) refreshGithub();
  }, [visible]);

  const githubConnected = !!githubStatus?.configured;
  const isConnected = (c) => c.id === 'github' && githubConnected;

  const list = useMemo(() => {
    let items = searchConnectors(query);
    if (category !== 'all') items = items.filter((c) => c.category === category);
    return items;
  }, [query, category]);

  const sections = useMemo(() => {
    const featuredSet = new Set(FEATURED_CONNECTOR_IDS);
    const connected = list.filter(isConnected);
    const featured = list.filter((c) => (c.featured || featuredSet.has(c.id)) && !isConnected(c));
    const available = list.filter((c) => !isConnected(c) && !(c.featured || featuredSet.has(c.id)));
    const out = [];
    if (connected.length) out.push({ title: 'Connected', data: connected });
    if (featured.length && !query && category === 'all') out.push({ title: 'Featured', data: featured });
    // When filtering/searching, fold Featured into Available to avoid empty buckets.
    const availData = (query || category !== 'all')
      ? list.filter((c) => !isConnected(c))
      : available;
    if (availData.length) {
      // Prefer category grouping when browsing All without search.
      if (!query && category === 'all') {
        out.push({ title: 'Available', data: availData });
      } else if (category !== 'all') {
        const cat = CONNECTOR_CATEGORIES.find((c) => c.id === category);
        out.push({ title: cat?.label || 'Available', data: availData });
      } else {
        out.push({ title: 'Results', data: availData });
      }
    }
    return out;
  }, [list, query, category, githubConnected]);

  const selected = selectedId ? connectorById(selectedId) : null;

  const header = (
    <View>
      <View style={[styles.searchWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Search connectors"
          placeholderTextColor={theme.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      <CategoryChips theme={theme} active={category} onChange={setCategory} />
    </View>
  );

  return (
    <>
      <GlassSheet visible={visible && !selected} onClose={onClose} title="Connectors" scroll={false}>
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
          ListEmptyComponent={
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>No connectors match.</Text>
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{section.title}</Text>
          )}
          renderItem={({ item: connector }) => (
            <View style={{ marginBottom: 10 }}>
              <GlassCard theme={theme} radius={16} style={{ padding: 10 }}>
                <ConnectorRow
                  theme={theme}
                  connector={connector}
                  connected={isConnected(connector)}
                  onPress={(c) => setSelectedId(c.id)}
                />
              </GlassCard>
            </View>
          )}
          initialNumToRender={12}
          windowSize={8}
          maxToRenderPerBatch={10}
        />
      </GlassSheet>

      <GlassSheet
        visible={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name || 'Connector'}
      >
        {selected?.id === 'github' ? (
          <GithubDetail
            theme={theme}
            status={githubStatus}
            onChanged={refreshGithub}
            onClose={() => setSelectedId(null)}
          />
        ) : selected ? (
          <ComingSoonDetail theme={theme} connector={selected} />
        ) : null}
      </GlassSheet>
    </>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 16, marginBottom: 8, marginLeft: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  connCard: { borderRadius: 12 },
  capChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingHorizontal: 2 },
  capChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: '48%' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  deviceCode: { fontSize: 34, fontWeight: '800', letterSpacing: 4, marginTop: 8, fontVariant: ['tabular-nums'] },
  primaryBtn: {
    minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
  },
  secondaryBtn: {
    minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, borderWidth: 1, flex: 1,
  },
  dangerBtn: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15 },
  capRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
