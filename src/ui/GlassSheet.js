/**
 * Shared full-screen glass sheet / modal used by every Settings sub-screen.
 * Replaces the eight duplicated plain Modal blocks.
 */
import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassFill, glassSurface, haptic, AmbientBackground } from './ios';
import { useTheme } from '../theme/useTheme';

/**
 * @param {{
 *  visible: boolean,
 *  onClose: () => void,
 *  title: string,
 *  children: React.ReactNode,
 *  loading?: boolean,
 *  footer?: React.ReactNode,
 *  right?: React.ReactNode,
 *  scroll?: boolean,
 * }} props
 */
export function GlassSheet({
  visible, onClose, title, children, loading = false, footer = null, right = null, scroll = true,
}) {
  const theme = useTheme();
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? { contentContainerStyle: styles.bodyContent, style: styles.body, keyboardShouldPersistTaps: 'handled' }
    : { style: [styles.body, styles.bodyContent] };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: theme.ambientBase }]}>
        <AmbientBackground theme={theme} />
        <View style={[styles.header, glassSurface(theme, 0), { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }]}>
          <GlassFill theme={theme} radius={0} strong />
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>{title}</Text>
          <View style={styles.headerRight}>
            {right}
            <TouchableOpacity
              onPress={() => { haptic.light(); onClose?.(); }}
              hitSlop={12}
              accessibilityLabel="Close"
              style={[styles.closeBtn, glassSurface(theme, 18)]}
            >
              <GlassFill theme={theme} radius={18} strong />
              <Ionicons name="close" size={20} color={theme.chromeIcon} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.info} />
          </View>
        ) : (
          <Body {...bodyProps}>{children}</Body>
        )}

        {footer ? (
          <View style={[styles.footer, glassSurface(theme, 0)]}>
            <GlassFill theme={theme} radius={0} strong />
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Glass card wrapper used inside sheets and Settings. */
export function GlassCard({ theme, children, style, radius = 14 }) {
  return (
    <View style={[styles.card, glassSurface(theme, radius), style]}>
      <GlassFill theme={theme} radius={radius} />
      {children}
    </View>
  );
}

/** Dark-mode adaptive status pill. */
export function StatusPill({ theme, tone = 'neutral', label }) {
  const tones = {
    ok: { bg: theme.successSoft, fg: theme.success },
    warn: { bg: theme.warningSoft, fg: theme.warning },
    bad: { bg: theme.dangerSoft, fg: theme.dangerText },
    info: { bg: theme.infoSoft, fg: theme.info },
    neutral: { bg: theme.surfaceAlt, fg: theme.textSecondary },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, overflow: 'hidden',
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, overflow: 'hidden' },
  card: { borderRadius: 14, padding: 14, overflow: 'hidden', marginBottom: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { fontSize: 11, fontWeight: '700' },
});
