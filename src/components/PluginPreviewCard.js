import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassFill, glassSurface, haptic } from '../ui/ios';
import { AppIconTile } from '../ui/icons';
import { StatusPill } from '../ui/GlassSheet';
import { pluginInstall } from '../plugins/pluginTools';
import { connectorById } from '../connectors/registry';
import { useComposerDraftStore } from '../store/composerDraftStore';

/**
 * Inline glass Plugin preview card rendered under a chat bubble when
 * plugin_create / plugin_install returned a pluginPreview payload.
 */
export function PluginPreviewCard({ preview, theme, onInstalled, onOpenConnector, onGoChat }) {
  const [busy, setBusy] = useState(false);
  if (!preview?.manifest) return null;
  const m = preview.manifest;
  const installed = preview.status === 'installed';

  const install = async () => {
    setBusy(true);
    const r = await pluginInstall({ manifest: m });
    setBusy(false);
    if (r.success) {
      haptic.success();
      onInstalled?.(r.data);
    } else {
      haptic.warning();
    }
    return r;
  };

  const refine = () => {
    haptic.light();
    useComposerDraftStore.getState().setDraft(
      `Improve the "${m.name}" plugin: `
    );
    onGoChat?.();
  };

  return (
    <View style={[styles.card, glassSurface(theme, 20)]} accessibilityLabel="Plugin preview">
      <GlassFill theme={theme} radius={20} strong />
      <View style={styles.header}>
        <AppIconTile k={m.icon || 'plugins'} size={40} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{m.name}</Text>
          <Text style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={3}>{m.description}</Text>
        </View>
        <StatusPill theme={theme} tone={installed ? 'ok' : 'info'} label={installed ? 'Installed' : 'Draft'} />
      </View>

      {(preview.requiredConnectors || m.requiredConnectors || []).length ? (
        <View style={styles.chips}>
          {(preview.requiredConnectors || m.requiredConnectors).map((id) => {
            const c = connectorById(id);
            return (
              <TouchableOpacity
                key={id}
                onPress={() => onOpenConnector?.(id)}
                style={[styles.chip, { backgroundColor: theme.warningSoft || theme.accentSoft, borderColor: theme.warning || theme.accent }]}
              >
                <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: '700' }}>
                  Needs {c?.name || id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <Text style={[styles.section, { color: theme.textSecondary }]}>Tools</Text>
      <Text style={{ color: theme.textPrimary, fontSize: 13, lineHeight: 18 }}>
        {(preview.allowedTools || m.allowedTools || []).slice(0, 8).join(' · ') || '—'}
      </Text>

      {(preview.permissions || m.permissions || []).length ? (
        <>
          <Text style={[styles.section, { color: theme.textSecondary }]}>Permissions</Text>
          {(preview.permissions || m.permissions).slice(0, 4).map((p) => (
            <View key={p} style={styles.permRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
              <Text style={{ color: theme.textPrimary, marginLeft: 8, flex: 1, fontSize: 13 }}>{p}</Text>
            </View>
          ))}
        </>
      ) : null}

      {(preview.examplePrompts || m.examplePrompts || []).length ? (
        <>
          <Text style={[styles.section, { color: theme.textSecondary }]}>Example prompts</Text>
          {(preview.examplePrompts || m.examplePrompts).slice(0, 3).map((ex) => (
            <Text key={ex} style={{ color: theme.textPrimary, fontSize: 13, marginBottom: 4 }}>“{ex}”</Text>
          ))}
        </>
      ) : null}

      <View style={styles.actions}>
        {!installed ? (
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}
            onPress={install}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={theme.textInverse} /> : (
              <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Install</Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.secondary, { borderColor: theme.borderStrong }]}
          onPress={refine}
        >
          <Text style={{ color: theme.info, fontWeight: '700' }}>{installed ? 'Improve in chat' : 'Edit / refine'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function parsePluginPreview(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
}

const styles = StyleSheet.create({
  card: { marginTop: 10, borderRadius: 20, padding: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700' },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  permRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primary: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 8 },
});
