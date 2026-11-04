/**
 * Settings > Plugins — Recommended / Installed / Created.
 * Create flow lives in chat (plugin_create / plugin_install), not here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Switch, Share, ScrollView,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';
import { haptic } from '../../ui/ios';
import { PLUGIN_TEMPLATES } from '../../plugins/catalog';
import {
  listPlugins, installTemplate, setPluginEnabled, deletePlugin,
  setPluginAllowReshare, getPlugin,
} from '../../plugins/pluginService';
import {
  createPluginShare, revokePluginShare, refreshPluginShareStats, recordSharedUninstall,
} from '../../plugins/shareClient';
import { useComposerDraftStore } from '../../store/composerDraftStore';
import { SharedPluginInstallSheet } from './SharedPluginInstallSheet';

const TABS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'installed', label: 'Installed' },
  { id: 'created', label: 'Created' },
];

const CREATE_STARTER =
  'Help me build a ZAO plugin. Ask what it should do, which tools and connectors it needs, then call plugin_create so I can preview and install it.';

function Sparkline({ values, color, width = 72, height = 24 }) {
  const pts = Array.isArray(values) && values.length ? values : [0];
  const max = Math.max(1, ...pts);
  const step = width / Math.max(1, pts.length - 1);
  const points = pts
    .map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function TabBar({ theme, tab, onChange }) {
  return (
    <View style={[styles.tabs, { backgroundColor: theme.fillTertiary || theme.borderSubtle }]}>
      {TABS.map((t) => {
        const on = tab === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => { haptic.select(); onChange(t.id); }}
            style={[styles.tab, on && { backgroundColor: theme.card || theme.fillPrimary, borderRadius: 10 }]}
          >
            <Text style={{ color: on ? theme.textPrimary : theme.textSecondary, fontWeight: on ? '700' : '600', fontSize: 13 }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ConnectorChips({ ids, theme }) {
  if (!ids?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {ids.map((id) => (
        <View key={id} style={[styles.chip, { borderColor: theme.borderStrong }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>{id}</Text>
        </View>
      ))}
    </View>
  );
}

function PluginRow({ theme, plugin, right, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ marginBottom: 10 }}>
      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIconTile k={plugin.icon || 'plugins'} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
              {plugin.name}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
              {plugin.description}
            </Text>
            <ConnectorChips ids={plugin.requiredConnectors} theme={theme} />
          </View>
          {right}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

function DetailSheet({ visible, onClose, theme, plugin, onChanged, onOpenShareInstall }) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(plugin);

  useEffect(() => { setLocal(plugin); }, [plugin]);

  if (!local) return null;
  const stats = local.installStats || {};
  const isCreated = local.source === 'created';
  const isShared = local.source === 'shared';

  const refreshStats = async () => {
    if (!isCreated) return;
    setBusy(true);
    const r = await refreshPluginShareStats(local);
    if (r?.data) setLocal(r.data);
    setBusy(false);
  };

  const onShare = async () => {
    setBusy(true);
    try {
      let token = local.shareToken;
      let url;
      let deepLink;
      if (!token) {
        const r = await createPluginShare(local);
        if (!r.success) {
          Alert.alert('Share failed', r.error === 'NOT_CONFIGURED'
            ? 'Connect your ZAO server in Settings first.'
            : String(r.error || 'Could not create share link'));
          setBusy(false);
          return;
        }
        token = r.data.token;
        url = r.data.url;
        deepLink = r.data.deepLink;
        const g = await getPlugin(local.id);
        if (g.data) setLocal(g.data);
      } else {
        const prefs = require('../../store/preferencesStore').usePreferencesStore.getState().preferences || {};
        const base = (prefs.backend_vm_url || '').replace(/\/+$/, '');
        url = base ? `${base}/p/${token}` : `zao://plugin/${token}`;
        deepLink = `zao://plugin/${token}`;
      }
      await Share.share({
        message: `Install my ZAO plugin “${local.name}”\n${url}\n${deepLink}`,
        url,
        title: local.name,
      });
      await refreshStats();
      onChanged?.();
    } catch (e) {
      Alert.alert('Share cancelled', e?.message || '');
    }
    setBusy(false);
  };

  const onRevoke = () => {
    Alert.alert('Revoke share link?', 'Anyone with the link will no longer be able to install this plugin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          setBusy(true);
          await revokePluginShare(local);
          const g = await getPlugin(local.id);
          if (g.data) setLocal(g.data);
          setBusy(false);
          onChanged?.();
        },
      },
    ]);
  };

  const onToggle = async (v) => {
    const r = await setPluginEnabled(local.id, v);
    if (r.data) setLocal(r.data);
    onChanged?.();
  };

  const onAllowReshare = async (v) => {
    const r = await setPluginAllowReshare(local.id, v);
    if (r.data) setLocal(r.data);
    onChanged?.();
  };

  const onRemove = () => {
    Alert.alert('Remove plugin?', local.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          if (local.sharedFromToken) {
            await recordSharedUninstall(local.sharedFromToken);
          }
          await deletePlugin(local.id);
          onChanged?.();
          onClose();
        },
      },
    ]);
  };

  return (
    <GlassSheet
      visible={visible}
      onClose={onClose}
      title={local.name}
      right={
        isCreated ? (
          <TouchableOpacity onPress={onShare} hitSlop={10} disabled={busy}>
            <Ionicons name="share-outline" size={22} color={theme.info || '#0A84FF'} />
          </TouchableOpacity>
        ) : null
      }
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIconTile k={local.icon || 'plugins'} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{local.description}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusPill theme={theme} tone={local.enabled ? 'ok' : 'neutral'} label={local.enabled ? 'Enabled' : 'Disabled'} />
              <StatusPill theme={theme} tone="neutral" label={local.source} />
              {isShared ? <StatusPill theme={theme} tone="warn" label="Read-only" /> : null}
            </View>
          </View>
        </View>

        {isCreated ? (
          <GlassCard theme={theme}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Installs: {stats.installs ?? 0}</Text>
                <Text style={{ color: theme.textSecondary, marginTop: 2 }}>Active: {stats.active ?? 0}</Text>
              </View>
              <Sparkline values={stats.sparkline || []} color={theme.info || '#0A84FF'} />
            </View>
            <TouchableOpacity onPress={refreshStats} style={{ marginTop: 10 }}>
              <Text style={{ color: theme.info, fontWeight: '600' }}>{busy ? 'Refreshing…' : 'Refresh stats'}</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : null}

        <GlassCard theme={theme}>
          <Text style={{ color: theme.textPrimary, fontWeight: '700', marginBottom: 8 }}>Tools</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {(local.allowedTools || []).join(', ') || '—'}
          </Text>
          <ConnectorChips ids={local.requiredConnectors} theme={theme} />
        </GlassCard>

        {isCreated ? (
          <GlassCard theme={theme}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Allow reshare</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Recipients can share this plugin further. Off by default.
                </Text>
              </View>
              <Switch value={!!local.allowReshare} onValueChange={onAllowReshare} />
            </View>
            {local.shareToken ? (
              <TouchableOpacity onPress={onRevoke} style={{ marginTop: 14 }}>
                <Text style={{ color: theme.dangerText || '#FF453A', fontWeight: '700' }}>Revoke share link</Text>
              </TouchableOpacity>
            ) : null}
          </GlassCard>
        ) : null}

        <GlassCard theme={theme}>
          <View style={styles.rowBetween}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Enabled</Text>
            <Switch value={!!local.enabled} onValueChange={onToggle} />
          </View>
        </GlassCard>

        {!isShared ? (
          <GlassCard theme={theme}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', marginBottom: 6 }}>Instructions</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
              {local.instructions}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard theme={theme}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Shared plugins are read-only. You can enable, disable, or remove them.
              {local.allowReshare ? ' The owner allowed resharing.' : ' Resharing is disabled by the owner.'}
            </Text>
            {local.allowReshare ? (
              <TouchableOpacity
                style={{ marginTop: 10 }}
                onPress={() => onOpenShareInstall?.(local.sharedFromToken)}
              >
                <Text style={{ color: theme.info, fontWeight: '700' }}>Reshare…</Text>
              </TouchableOpacity>
            ) : null}
          </GlassCard>
        )}

        <TouchableOpacity onPress={onRemove} style={[styles.dangerBtn, { borderColor: theme.dangerText || '#FF453A' }]}>
          <Text style={{ color: theme.dangerText || '#FF453A', fontWeight: '700' }}>Remove</Text>
        </TouchableOpacity>
      </View>
    </GlassSheet>
  );
}

export function PluginsHub({ visible, onClose, theme, onGoChat }) {
  const [tab, setTab] = useState('recommended');
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const setDraft = useComposerDraftStore((s) => s.setDraft);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await listPlugins();
    setPlugins(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const installed = useMemo(
    () => plugins.filter((p) => ['template', 'shared', 'custom', 'created'].includes(p.source)),
    [plugins]
  );
  const created = useMemo(() => plugins.filter((p) => p.source === 'created'), [plugins]);
  const installedIds = useMemo(
    () => new Set(plugins.filter((p) => p.templateId).map((p) => p.templateId)),
    [plugins]
  );

  const installTpl = async (tpl) => {
    haptic.light();
    const r = await installTemplate(tpl.id);
    if (!r.success) {
      Alert.alert('Install failed', r.error || 'Unknown error');
      return;
    }
    await reload();
  };

  const openCreateInChat = () => {
    setDraft(CREATE_STARTER);
    onClose?.();
    onGoChat?.();
  };

  return (
    <>
      <GlassSheet visible={visible} onClose={onClose} title="Plugins" scroll={false}>
        <TabBar theme={theme} tab={tab} onChange={setTab} />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.info} />
        ) : (
          <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {tab === 'recommended' ? (
              PLUGIN_TEMPLATES.map((tpl) => {
                const already = installedIds.has(tpl.id);
                return (
                  <PluginRow
                    key={tpl.id}
                    theme={theme}
                    plugin={tpl}
                    onPress={() => already ? null : installTpl(tpl)}
                    right={
                      already ? (
                        <StatusPill theme={theme} tone="ok" label="Installed" />
                      ) : (
                        <TouchableOpacity onPress={() => installTpl(tpl)} style={[styles.installBtn, { backgroundColor: theme.info || '#0A84FF' }]}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Install</Text>
                        </TouchableOpacity>
                      )
                    }
                  />
                );
              })
            ) : null}

            {tab === 'installed' ? (
              installed.length === 0 ? (
                <GlassCard theme={theme}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>No plugins yet</Text>
                  <Text style={{ color: theme.textSecondary, marginTop: 6 }}>
                    Install from Recommended, or create one in chat with Plugin Builder.
                  </Text>
                </GlassCard>
              ) : (
                installed.map((p) => (
                  <PluginRow
                    key={p.id}
                    theme={theme}
                    plugin={p}
                    onPress={() => setDetail(p)}
                    right={<Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />}
                  />
                ))
              )
            ) : null}

            {tab === 'created' ? (
              created.length === 0 ? (
                <GlassCard theme={theme}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>Create in chat</Text>
                  <Text style={{ color: theme.textSecondary, marginTop: 6, lineHeight: 18 }}>
                    Plugins are drafted with the plugin_create tool and installed from an inline preview card. Your creations stay private until you share them.
                  </Text>
                  <TouchableOpacity
                    onPress={openCreateInChat}
                    style={[styles.installBtn, { backgroundColor: theme.info || '#0A84FF', alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 16 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Open chat with starter prompt</Text>
                  </TouchableOpacity>
                </GlassCard>
              ) : (
                created.map((p) => (
                  <PluginRow
                    key={p.id}
                    theme={theme}
                    plugin={p}
                    onPress={() => setDetail(p)}
                    right={
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <TouchableOpacity
                          onPress={async () => {
                            setDetail(p);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="share-outline" size={20} color={theme.info || '#0A84FF'} />
                        </TouchableOpacity>
                        {p.installStats ? (
                          <Text style={{ color: theme.textTertiary, fontSize: 11 }}>
                            {p.installStats.installs || 0} installs
                          </Text>
                        ) : null}
                      </View>
                    }
                  />
                ))
              )
            ) : null}
          </ScrollView>
        )}
      </GlassSheet>

      <DetailSheet
        visible={!!detail}
        onClose={() => setDetail(null)}
        theme={theme}
        plugin={detail}
        onChanged={reload}
        onOpenShareInstall={(token) => setShareToken(token)}
      />

      <SharedPluginInstallSheet
        visible={!!shareToken}
        token={shareToken}
        theme={theme}
        onClose={() => setShareToken(null)}
        onInstalled={reload}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  installBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
});
