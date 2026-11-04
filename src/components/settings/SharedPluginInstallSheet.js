/**
 * Glass sheet: Install shared plugin (deep link / share token).
 * Runs compatibility check; disables Install when unsuitable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';
import { CONNECTORS } from '../../connectors/registry';
import {
  fetchSharedPluginPublic,
  installFromShareToken,
} from '../../plugins/shareClient';
import { checkSharedPluginCompatibility } from '../../plugins/shareCompat';
import { getKnownTools, setKnownTools } from '../../plugins/schema';

function loadKnownTools() {
  let tools = getKnownTools();
  if (tools && tools.size) return tools;
  try {
    // eslint-disable-next-line global-require
    const { TOOL_REGISTRY } = require('../../services/toolOrchestrator');
    tools = new Set(Object.keys(TOOL_REGISTRY || {}));
    setKnownTools([...tools]);
  } catch (_) {
    tools = new Set();
  }
  return tools;
}

export function SharedPluginInstallSheet({
  visible, token, theme, onClose, onInstalled, onConnectConnector,
  forceIncompatible = false,
}) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!visible || !token) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSnapshot(null);
      const r = await fetchSharedPluginPublic(token);
      if (cancelled) return;
      if (!r.success) {
        setError(r.error === 'REVOKED' ? 'This share link was revoked.' : (r.error || 'Could not load plugin'));
        setLoading(false);
        return;
      }
      setSnapshot(r.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [visible, token]);

  const connectorIds = useMemo(() => CONNECTORS.map((c) => c.id), []);
  const knownTools = useMemo(() => loadKnownTools(), [visible]);

  const compat = useMemo(() => {
    if (!snapshot) return null;
    if (forceIncompatible) {
      return {
        ok: false,
        reasons: ['Requires tools not in this app version: example_future_tool'],
        missingTools: ['example_future_tool'],
        missingConnectors: [],
      };
    }
    return checkSharedPluginCompatibility(snapshot, {
      knownTools,
      availableConnectorIds: connectorIds,
    });
  }, [snapshot, knownTools, connectorIds, forceIncompatible]);

  const m = snapshot?.manifest;

  const onInstall = async () => {
    if (!compat?.ok) return;
    setInstalling(true);
    const r = await installFromShareToken(token, { knownTools });
    setInstalling(false);
    if (!r.success) {
      Alert.alert('Install failed', r.error || 'Unknown error');
      return;
    }
    onInstalled?.(r.data);
    onClose?.();
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} title="Install shared plugin">
      {loading ? (
        <ActivityIndicator color={theme.info} style={{ marginTop: 24 }} />
      ) : error ? (
        <GlassCard theme={theme}>
          <Text style={{ color: theme.dangerText || '#FF453A', fontWeight: '700' }}>{error}</Text>
        </GlassCard>
      ) : m ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <AppIconTile k={m.icon || 'plugins'} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 20 }}>{m.name}</Text>
              <Text style={{ color: theme.textSecondary, marginTop: 2 }}>
                Shared by {snapshot.ownerName || 'ZAO user'}
              </Text>
            </View>
          </View>

          <Text style={{ color: theme.textSecondary, lineHeight: 20 }}>{m.description}</Text>

          <GlassCard theme={theme}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', marginBottom: 6 }}>Permissions</Text>
            {(m.permissions || []).length ? (
              (m.permissions || []).map((p) => (
                <Text key={p} style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 4 }}>• {p}</Text>
              ))
            ) : (
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>No special permissions listed.</Text>
            )}
          </GlassCard>

          <GlassCard theme={theme}>
            <Text style={{ color: theme.textPrimary, fontWeight: '700', marginBottom: 6 }}>Tools</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {(m.allowedTools || []).join(', ')}
            </Text>
          </GlassCard>

          {(m.requiredConnectors || []).length ? (
            <GlassCard theme={theme}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700', marginBottom: 8 }}>Required connectors</Text>
              {(m.requiredConnectors || []).map((id) => {
                const missing = compat?.missingConnectors?.includes(id);
                return (
                  <View key={id} style={styles.rowBetween}>
                    <Text style={{ color: theme.textSecondary }}>{id}</Text>
                    {missing ? (
                      <TouchableOpacity onPress={() => onConnectConnector?.(id)}>
                        <StatusPill theme={theme} tone="warn" label="Connect" />
                      </TouchableOpacity>
                    ) : (
                      <StatusPill theme={theme} tone="ok" label="Available" />
                    )}
                  </View>
                );
              })}
            </GlassCard>
          ) : null}

          {compat && !compat.ok ? (
            <GlassCard theme={theme} style={{ borderColor: theme.dangerText || '#FF453A' }}>
              <Text style={{ color: theme.dangerText || '#FF453A', fontWeight: '700', marginBottom: 6 }}>
                Not compatible with this app
              </Text>
              {compat.reasons.map((r) => (
                <Text key={r} style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 4 }}>• {r}</Text>
              ))}
            </GlassCard>
          ) : (
            <StatusPill theme={theme} tone="ok" label="Compatible" />
          )}

          <TouchableOpacity
            disabled={!compat?.ok || installing}
            onPress={onInstall}
            style={[
              styles.install,
              {
                backgroundColor: compat?.ok ? (theme.info || '#0A84FF') : (theme.fillTertiary || '#333'),
                opacity: compat?.ok ? 1 : 0.55,
              },
            ]}
          >
            {installing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {compat?.ok ? 'Install' : 'Install unavailable'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  install: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
