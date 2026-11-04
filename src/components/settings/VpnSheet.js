import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';

/**
 * VPN placeholder — UI only. Real tunneling arrives later.
 */
export function VpnSheet({ visible, onClose, theme }) {
  return (
    <GlassSheet visible={visible} onClose={onClose} title="VPN">
      <GlassCard theme={theme}>
        <AppIconTile k="vpn" size={56} />
        <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 14 }}>Private network</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 8, lineHeight: 20 }}>
          Route ZAO agent traffic through an encrypted tunnel. Configuration and providers will land in a later update.
        </Text>
        <View style={{ marginTop: 14 }}>
          <StatusPill theme={theme} tone="info" label="Coming soon" />
        </View>
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Planned</Text>
      <GlassCard theme={theme}>
        {[
          'One-tap connect / disconnect',
          'Per-session kill switch',
          'Provider profiles',
          'Split tunneling for connectors',
        ].map((line, i) => (
          <View key={line} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
            <Text style={{ color: theme.textPrimary, flex: 1 }}>{line}</Text>
          </View>
        ))}
      </GlassCard>

      <TouchableOpacity style={[styles.btn, { backgroundColor: theme.fill }]} disabled>
        <Text style={{ color: theme.textTertiary, fontWeight: '700' }}>Connect · coming soon</Text>
      </TouchableOpacity>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 8, marginBottom: 8, marginLeft: 4,
  },
  row: { paddingVertical: 12 },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
