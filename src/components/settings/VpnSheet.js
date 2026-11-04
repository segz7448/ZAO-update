import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile } from '../../ui/icons';
import { haptic } from '../../ui/ios';

/**
 * VPN placeholder — advanced glass UI only. Real tunneling arrives later.
 * Toggles/buttons are interactive in the shell so theme + state feel real;
 * connect remains disabled until a provider is wired.
 */
export function VpnSheet({ visible, onClose, theme }) {
  const [killSwitch, setKillSwitch] = useState(true);
  const [splitTunnel, setSplitTunnel] = useState(true);
  const [profile, setProfile] = useState('secure');

  const profiles = [
    { id: 'secure', label: 'Secure', sub: 'Full tunnel · all agent traffic' },
    { id: 'split', label: 'Split', sub: 'Connectors only · local apps direct' },
    { id: 'stealth', label: 'Stealth', sub: 'Obfuscated · higher latency' },
  ];

  return (
    <GlassSheet visible={visible} onClose={onClose} title="VPN">
      <GlassCard theme={theme} radius={18} style={{ alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AppIconTile k="vpn" size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '700' }}>Private network</Text>
            <Text style={{ color: theme.textSecondary, marginTop: 4, lineHeight: 18 }}>
              Encrypted tunnel for ZAO agent traffic. Providers land in a later update.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <StatusPill theme={theme} tone="info" label="Coming soon" />
          <StatusPill theme={theme} tone="neutral" label="Not connected" />
        </View>
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Profile</Text>
      <GlassCard theme={theme} radius={16} style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
        {profiles.map((p, i) => {
          const on = profile === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => { haptic.select(); setProfile(p.id); }}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
            >
              <AppIconTile k="vpn" size={28} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 16 }}>{p.label}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{p.sub}</Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={theme.brand} /> : null}
            </TouchableOpacity>
          );
        })}
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Safety</Text>
      <GlassCard theme={theme} radius={16}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Kill switch</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Block agent network if the tunnel drops</Text>
          </View>
          <Switch
            value={killSwitch}
            onValueChange={(v) => { haptic.select(); setKillSwitch(v); }}
            trackColor={{ false: theme.fill, true: theme.switchTrack }}
            ios_backgroundColor={theme.fill}
          />
        </View>
        <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, paddingTop: 12, marginTop: 4 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Split tunneling</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Only route connector traffic through VPN</Text>
          </View>
          <Switch
            value={splitTunnel}
            onValueChange={(v) => { haptic.select(); setSplitTunnel(v); }}
            trackColor={{ false: theme.fill, true: theme.switchTrack }}
            ios_backgroundColor={theme.fill}
          />
        </View>
      </GlassCard>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.fill }]}
        disabled
        accessibilityState={{ disabled: true }}
      >
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
