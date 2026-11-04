/**
 * ZAO - Attachment Sheet
 *
 * Bottom sheet shown when the "+" button is tapped in the chat input bar.
 * Matches the reference layout: three square action tiles (Camera/Photos/
 * Files) up top, then a list of toggles below.
 *
 * Camera/Photos/Files are wired to real onPress callbacks in ChatScreen.js
 * (handleCamera/handlePhotos/handleFiles - expo-image-picker /
 * expo-document-picker, permission checks included) - file handling is
 * fully built, not a stub.
 * Web search is wired to a real tool (server/webSearch.js via
 * src/services/search/webSearchTool.js) - web_search is registered as
 * an always-available tool (src/services/toolOrchestrator.js) the model
 * can call whenever a request needs it, regardless of this toggle's
 * state. The toggle's value IS also threaded through: ChatScreen.js
 * passes it into sendMessage -> orchestrator.js's webSearchEnabled param
 * -> agentLoop.js, which injects a system-prompt hint telling the model
 * to prioritize web_search for that turn when the toggle is on.
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Grabber, IconTile, GlassFill, haptic } from '../ui/ios';
import { useTheme } from '../theme/useTheme';

function ActionRow({ icon, color, label, onPress, theme, last }) {
  return (
    <TouchableOpacity
      style={styles.actionRow}
      onPress={() => { haptic.light(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconTile name={icon} color={color} />
      <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
      {!last && <View style={[styles.rowSep, { backgroundColor: theme.separator }]} />}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, color, label, value, onValueChange, theme, disabled = false, subtitle = null, last }) {
  return (
    <View style={[styles.actionRow, disabled && { opacity: 0.5 }]}>
      <IconTile name={icon} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: theme.textPrimary, flex: 0 }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : (v) => { haptic.select(); onValueChange?.(v); }}
        disabled={disabled}
        trackColor={{ false: theme.fill, true: theme.switchTrack }}
        ios_backgroundColor={theme.fill}
      />
      {!last && <View style={[styles.rowSep, { backgroundColor: theme.separator }]} />}
    </View>
  );
}

export default function AttachmentSheet({
  visible,
  onClose,
  onCamera,
  onPhotos,
  onFiles,
  webSearchEnabled,
  onToggleWebSearch,
  githubEnabled,
  onToggleGithub,
  githubConfigured = true,
}) {
  const theme = useTheme();

  const groupBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.62)';
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { borderWidth: 1, borderBottomWidth: 0, borderColor: theme.glassHighlight }]}>
        <GlassFill theme={theme} radius={0} strong intensity={70} shapeStyle={{ borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
        <Grabber theme={theme} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Add to Chat</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={[styles.closeBtn, { backgroundColor: theme.fill }]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.group, { backgroundColor: groupBg, borderWidth: 1, borderColor: theme.glassHighlight }]}>
          <ActionRow icon="camera" color={theme.tileColors.gray} label="Camera" onPress={onCamera} theme={theme} />
          <ActionRow icon="images" color={theme.tileColors.blue} label="Photos" onPress={onPhotos} theme={theme} />
          <ActionRow icon="document" color={theme.tileColors.orange} label="Files" onPress={onFiles} theme={theme} last />
        </View>

        <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>TOOLS</Text>
        <View style={[styles.group, { backgroundColor: groupBg, borderWidth: 1, borderColor: theme.glassHighlight }]}>
          <ToggleRow
            icon="globe"
            color={theme.tileColors.teal}
            label="Web Search"
            subtitle="Search the web when useful"
            value={webSearchEnabled}
            onValueChange={onToggleWebSearch}
            theme={theme}
          />
          <ToggleRow
            icon="logo-github"
            color={theme.mode === 'dark' ? '#48484A' : '#1C1C1E'}
            label="GitHub"
            subtitle={githubConfigured ? 'Use your GitHub repos when useful' : 'Add your GitHub token in Settings first'}
            value={githubEnabled}
            onValueChange={onToggleGithub}
            theme={theme}
            last
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingHorizontal: 16, paddingBottom: 34, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, marginTop: 4,
  },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: 10, overflow: 'hidden' },
  groupLabel: { fontSize: 13, letterSpacing: -0.08, marginTop: 22, marginBottom: 7, marginLeft: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, paddingVertical: 8 },
  actionLabel: { flex: 1, fontSize: 17, letterSpacing: -0.41 },
  rowSep: { position: 'absolute', left: 55, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  toggleSubtitle: { fontSize: 13, marginTop: 1, letterSpacing: -0.08 },
});
