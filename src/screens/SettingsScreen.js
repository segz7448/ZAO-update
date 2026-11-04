import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconTile, GlassFill, glassSurface, haptic } from '../ui/ios';
import { AppIconTile } from '../ui/icons';
import { StatusPill } from '../ui/GlassSheet';
import { ConnectorsHub } from '../components/settings/ConnectorsHub';
import { VaultSheet } from '../components/settings/VaultSheet';
import { VpnSheet } from '../components/settings/VpnSheet';
import { PluginsHub } from '../components/settings/PluginsHub';
import { usePreferencesStore } from '../store/preferencesStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme/useTheme';
import { checkBackendHealth, testOpenRouterKey } from '../services/backend/backendClient';
import {
  getUsageCounts,
  getRecentUsageEvents,
  getAllMemories,
  updateMemory,
  deactivateMemory,
  hardDeleteMemory,
  clearAllMemories,
  getRecentCheckpoints,
} from '../db/database';
import { ACTIVE_MODEL } from '../config/localModels';
import {
  getWeeklyUsage,
  getSubscription,
  getUsageManagePrefs,
  setSoftLimitEnabled,
  setAlertPercent,
} from '../billing';
import { rewindToCheckpoint } from '../services/filesystem/filesystemTool';
import { getRecentSpans } from '../services/execution/telemetry';
import { PERMISSION_MODES } from '../services/execution/permissionModes';
import { listReminders, cancelReminder, forgetReminder } from '../services/reminders/reminderService';
import { migrateGithubTokenIntoVault, getVaultSecuritySummary } from '../vault/vaultService';
import { listInstalledPlugins } from '../plugins/pluginService';
import { vpn } from '../vpn';


/** Resolve the Settings account display name from prefs / memory — never hard-code. */
function resolveProfileName(preferences, memories = []) {
  const fromPrefs = preferences?.display_name || preferences?.user_name;
  if (fromPrefs && String(fromPrefs).trim()) return String(fromPrefs).trim();
  for (const m of memories || []) {
    const cat = String(m.category || '').toLowerCase();
    const content = String(m.content || '');
    if (cat === 'name' || cat === 'profile' || cat === 'identity') {
      const m1 = content.match(/(?:my name is|i(?:'m| am)|call me)\s+([A-Z][A-Za-z'-]{1,40})/i);
      if (m1) return m1[1];
      if (/^[A-Z][A-Za-z'-]{1,40}$/.test(content.trim())) return content.trim();
    }
    const m2 = content.match(/(?:my name is|i(?:'m| am)|call me)\s+([A-Z][A-Za-z'-]{1,40})/i);
    if (m2) return m2[1];
  }
  if (preferences?.github_username) return preferences.github_username;
  return 'Account';
}

function buildAccountSubtitle(preferences, { vaultItems = 0, plugins = 0, vpnOn = false } = {}) {
  const bits = [];
  if (preferences?.github_username) bits.push('GitHub');
  if (vaultItems > 0) bits.push('Vault');
  if (preferences?.memory_enabled !== false) bits.push('memory');
  if (!bits.length) {
    if (plugins) bits.push('Plugins');
    if (vpnOn) bits.push('VPN');
  }
  if (!bits.length) return 'Profile & connected accounts';
  if (bits.length === 1) return bits[0];
  if (bits.length === 2) return `${bits[0]} & ${bits[1]}`;
  return `${bits.slice(0, -1).join(', ')} & ${bits[bits.length - 1]}`;
}


function AccountSheet({ visible, onClose, theme, preferences, profileName, subtitle }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Account</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible', alignItems: 'center', paddingVertical: 20 }]}>
            <GlassFill theme={theme} radius={10} />
            <AppIconTile k="account" size={64} />
            <Text style={{ marginTop: 12, fontSize: 22, fontWeight: '700', color: theme.textPrimary }}>{profileName}</Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: theme.textSecondary }}>{subtitle}</Text>
          </View>

          <SectionHeader title="Profile" theme={theme} />
          <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
            <GlassFill theme={theme} radius={10} />
            <View style={styles.navRow}>
              <AppIconTile k="account" size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Name</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>{profileName}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.navRow}>
              <AppIconTile k="github" size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>GitHub</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {preferences?.github_username || 'Not connected'}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.navRow}>
              <AppIconTile k="memory" size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Memory</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {preferences?.memory_enabled !== false ? 'On' : 'Off'}
                </Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.navRow}>
              <AppIconTile k="server" size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Backend</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {preferences?.backend_vm_url ? 'Configured' : 'Not set'}
                </Text>
              </View>
            </View>
          </View>

          <SectionHeader title="Session" theme={theme} />
          <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
            <GlassFill theme={theme} radius={10} />
            <TouchableOpacity style={styles.navRow} onPress={() => { /* placeholder */ }} disabled>
              <AppIconTile k="permissions" size={30} />
              <Text style={[styles.navRowLabel, { color: theme.textSecondary, flex: 1 }]}>Sign out</Text>
              <Text style={{ fontSize: 13, color: theme.textTertiary }}>Coming soon</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}


function SettingsNavRow({ theme, iconKey, label, onPress, value, showIcon = true }) {
  return (
    <TouchableOpacity
      style={styles.navRow}
      onPress={() => { haptic.light(); onPress?.(); }}
    >
      {showIcon && iconKey ? <AppIconTile k={iconKey} size={30} /> : null}
      <Text style={[styles.navRowLabel, { color: theme.textPrimary, flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={[styles.navRowValue, { color: theme.textSecondary }]} numberOfLines={1}>{value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  );
}

function formatRenewsAt(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return '—';
  }
}

function priceDisplay(sub) {
  if (sub?.priceLabel) {
    const period = sub.period ? `/${sub.period}` : '';
    return `${sub.priceLabel}${period}`;
  }
  return 'Set in server config';
}

/** Settings home USAGE group: Usage + optional Subscription rows (no sparkline / counts). */
function UsageGroupCard({ theme, onOpenUsage, onOpenSubscription }) {
  const [usageTrail, setUsageTrail] = useState('…');
  const [planTrail, setPlanTrail] = useState('Pro');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usage, sub] = await Promise.all([getWeeklyUsage(), getSubscription()]);
        if (cancelled) return;
        setUsageTrail(`${usage.percent}% this week`);
        setPlanTrail(sub.plan || 'Pro');
      } catch (_) {
        if (!cancelled) {
          setUsageTrail('—');
          setPlanTrail('Pro');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
      <GlassFill theme={theme} radius={10} />
      <SettingsNavRow
        theme={theme}
        iconKey="usage"
        label="Usage"
        value={usageTrail}
        onPress={onOpenUsage}
      />
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <SettingsNavRow
        theme={theme}
        iconKey="subscription"
        label="Subscription"
        value={planTrail}
        onPress={onOpenSubscription}
      />
    </View>
  );
}

function GithubCredentialsSection({ status, onSaveUsername, onSaveToken, onRemove, theme }) {
  const [usernameValue, setUsernameValue] = useState(status.username || '');
  const [tokenValue, setTokenValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTestAndSave = async () => {
    if (!usernameValue.trim() || !tokenValue.trim()) return;
    setTesting(true);
    try {
      const { verifyToken } = await import('../services/github/githubTool');
      const result = await verifyToken(tokenValue.trim());
      if (result.valid) {
        // Save the username the person typed, not result.username, in
        // case they're intentionally managing repos under an
        // organization they belong to rather than their own login - the
        // token verification just confirms the token itself works, not
        // that this exact string has to match the token owner's login.
        await onSaveUsername(usernameValue.trim());
        await onSaveToken(tokenValue.trim());
        setEditing(false);
        setTokenValue('');
        Alert.alert('Connected', `GitHub token verified (authenticated as ${result.username}).`);
      } else {
        Alert.alert(
          'Connection failed',
          result.error?.message || 'Could not verify this token. Check it and try again.'
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong testing this token. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove GitHub access?',
      'This removes your GitHub username and token. The local coder model won\'t be able to create repos, commit, or push until you add them again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ]
    );
  };

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>GitHub</Text>
        <View style={[styles.statusPill, { backgroundColor: status.configured ? theme.successSoft || theme.accentSoft : theme.surfaceAlt }]}>
          <Text style={[styles.statusPillText, { color: status.configured ? theme.success : theme.textSecondary }]}>
            {status.configured ? `Connected · ${status.username}` : 'Not set'}
          </Text>
        </View>
      </View>

      {editing ? (
        <View>
          <TextInput
            style={[styles.keyInput, { borderColor: theme.borderStrong, color: theme.textPrimary }]}
            value={usernameValue}
            onChangeText={setUsernameValue}
            placeholder="GitHub username"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.keyInput, { borderColor: theme.borderStrong, color: theme.textPrimary, marginTop: 8 }]}
            value={tokenValue}
            onChangeText={setTokenValue}
            placeholder="Personal access token (repo scope)"
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.keyRowButtons}>
            <TouchableOpacity
              style={styles.keySecondaryBtn}
              onPress={() => { setEditing(false); setTokenValue(''); setUsernameValue(status.username || ''); }}
            >
              <Text style={[styles.keySecondaryBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.keyPrimaryBtn,
                { backgroundColor: theme.accent },
                (!usernameValue.trim() || !tokenValue.trim() || testing) && { backgroundColor: theme.borderStrong },
              ]}
              onPress={handleTestAndSave}
              disabled={!usernameValue.trim() || !tokenValue.trim() || testing}
            >
              {testing
                ? <ActivityIndicator size="small" color={theme.textInverse} />
                : <Text style={[styles.keyPrimaryBtnText, { color: theme.textInverse }]}>Test & Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.keyRowButtons}>
          {status.configured && (
            <TouchableOpacity style={styles.keySecondaryBtn} onPress={handleRemove}>
              <Text style={[styles.keyRemoveBtnText, { color: theme.danger }]}>Remove</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.keyEditBtn} onPress={() => setEditing(true)}>
            <Text style={[styles.keyEditBtnText, { color: theme.info }]}>
              {status.configured ? 'Update' : 'Connect GitHub'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FilesystemAccessSection({ preferences, theme }) {
  const [requesting, setRequesting] = useState(false);
  const grantFilesystemAccess = usePreferencesStore((s) => s.grantFilesystemAccess);

  const granted = !!preferences?.filesystem_saf_uri;

  const handleGrantAccess = async () => {
    setRequesting(true);
    try {
      // grantFilesystemAccess() (preferencesStore.js) both requests the
      // SAF permission AND reloads the store afterward, so `preferences`
      // here (and the "Granted" pill below) update immediately instead of
      // only reflecting the new URI after the app is restarted.
      const result = await grantFilesystemAccess();
      if (!result.success) {
        Alert.alert('Access not granted', result.error?.message || 'Folder access was not granted.');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong requesting folder access.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Download folder</Text>
        <View style={[styles.statusPill, { backgroundColor: granted ? (theme.successSoft || theme.accentSoft) : theme.surfaceAlt }]}>
          <Text style={[styles.statusPillText, { color: granted ? theme.success : theme.textSecondary }]}>
            {granted ? 'Granted' : 'Not granted'}
          </Text>
        </View>
      </View>
      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 4 }]}>
        {granted
          ? 'Files ZAO builds on the backend land here when you download them from chat. Grant a different folder anytime below.'
          : 'Android requires granting access to a specific folder before ZAO can save anything to your device. This is a one-time system permission - pick a folder like Download. ZAO builds and stores everything on the backend; this folder is only where finished files go when you tap to download them.'}
      </Text>
      <TouchableOpacity
        style={[styles.keyEditBtn, { marginTop: 12 }]}
        onPress={handleGrantAccess}
        disabled={requesting}
      >
        {requesting
          ? <ActivityIndicator size="small" color={theme.info} />
          : <Text style={[styles.keyEditBtnText, { color: theme.info }]}>{granted ? 'Change folder' : 'Grant folder access'}</Text>}
      </TouchableOpacity>
    </View>
  );
}

/**
 * Server connection section - the backend runs on a dedicated, 24/7
 * Alibaba Cloud VM (see /server in the repo root) instead of on-device
 * or on a person's PC. Three independent Test & Save flows now, same
 * pattern as GithubCredentialsSection above:
 *   - VmConnectionSection: the VM's IP (or IP:port), e.g.
 *     http://123.45.67.89:8000 - Test just confirms the server is
 *     reachable (no API key needed for that half of the check).
 *   - ModelApiKeySection: the VM's own shared secret, sent as
 *     `Authorization: Bearer <token>` on every request - must match
 *     AUTH_TOKEN in the VM's server/config.js. This gates the VM itself,
 *     not the model - kept named "Model API key" in the UI since that's
 *     what people are used to, but see OpenRouterApiKeySection below for
 *     the key that actually reaches the model now.
 *   - OpenRouterApiKeySection: the person's own OpenRouter key (from
 *     https://openrouter.ai/keys) - this is what the VM uses to call
 *     OpenRouter for chat completions (currently `stealth/ox-alpha`),
 *     now that the model has moved off Alibaba Model Studio. Sent as
 *     `X-OpenRouter-Key` on every VM request, validated against
 *     OpenRouter itself via the VM's /openrouter/key-status route.
 * Also covers the Terminal tool, which runs through this same
 * connection (bash/Python on the VM via /terminal/run) - the only
 * terminal ZAO has. There is no on-device fallback terminal.
 */
function VmConnectionSection({ preferences, theme }) {
  const setBackendVmUrl = usePreferencesStore((s) => s.setBackendVmUrl);
  const savedUrl = preferences?.backend_vm_url || '';
  const [urlValue, setUrlValue] = useState(savedUrl);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState({ reachable: false, ready: false, model: null });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setUrlValue(savedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedUrl]);

  const runCheck = async (urlToCheck) => {
    const result = await testBackendConnection({ url: urlToCheck, token: preferences?.backend_auth_token });
    setStatus(result);
    setChecked(true);
    return result;
  };

  useEffect(() => {
    if (savedUrl) runCheck(savedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedUrl]);

  const isDirty = urlValue.trim() !== savedUrl;

  const handleTestAndSave = async () => {
    let url = urlValue.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    setTesting(true);
    const result = await runCheck(url);
    if (result.reachable) {
      await setBackendVmUrl(url);
      setUrlValue(url);
      Alert.alert('Connected', result.ready ? `Reached the VM · ${result.model || ACTIVE_MODEL.label} is ready.` : 'Reached the VM - the model is still loading.');
    } else {
      Alert.alert('Connection failed', result.error || "Couldn't reach that address. Check the IP/port and that the server is running.");
    }
    setTesting(false);
  };

  const pillColor = status.ready ? (theme.successSoft || theme.accentSoft) : status.reachable ? (theme.warningSoft || theme.accentSoft) : (theme.dangerSoft);
  const pillTextColor = status.ready ? theme.success : status.reachable ? theme.warning : theme.dangerText;
  const pillLabel = !checked
    ? 'Not checked'
    : status.ready
    ? `Reachable · ${status.model || ACTIVE_MODEL.label}`
    : status.reachable
    ? 'Reachable · model loading'
    : 'Not reachable';

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Alibaba Cloud VM</Text>
        <View style={[styles.statusPill, { backgroundColor: pillColor }]}>
          <Text style={[styles.statusPillText, { color: pillTextColor }]}>{pillLabel}</Text>
        </View>
      </View>

      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 8 }]}>
        The VM's IP and port, e.g. 123.45.67.89:8000. The VM runs 24/7, so this stays the same once set.
      </Text>
      <TextInput
        style={[styles.keyInput, { borderColor: theme.borderStrong, color: theme.textPrimary, marginTop: 8 }]}
        placeholder="123.45.67.89:8000"
        placeholderTextColor={theme.textTertiary}
        value={urlValue}
        onChangeText={setUrlValue}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <View style={styles.keyRowButtons}>
        <TouchableOpacity
          style={[
            styles.keyPrimaryBtn,
            { backgroundColor: theme.accent },
            (!urlValue.trim() || testing) && { backgroundColor: theme.borderStrong },
          ]}
          onPress={handleTestAndSave}
          disabled={!urlValue.trim() || testing}
        >
          {testing
            ? <ActivityIndicator size="small" color={theme.textInverse} />
            : <Text style={[styles.keyPrimaryBtnText, { color: theme.textInverse }]}>Test & Save</Text>}
        </TouchableOpacity>
        {savedUrl && (
          <TouchableOpacity style={styles.keySecondaryBtn} onPress={() => runCheck(savedUrl)} disabled={testing}>
            <Text style={[styles.keySecondaryBtnText, { color: theme.textSecondary }]}>Check again</Text>
          </TouchableOpacity>
        )}
      </View>
      {isDirty && (
        <Text style={[styles.helperText, { color: theme.textTertiary, marginTop: 6, fontSize: 12 }]}>
          Unsaved - tap Test & Save to apply.
        </Text>
      )}
    </View>
  );
}

function ModelApiKeySection({ preferences, theme }) {
  const setBackendAuthToken = usePreferencesStore((s) => s.setBackendAuthToken);
  const savedToken = preferences?.backend_auth_token || '';
  const vmUrl = preferences?.backend_vm_url || '';
  const [tokenValue, setTokenValue] = useState(savedToken);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState({ reachable: false, authValid: null });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setTokenValue(savedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedToken]);

  const runCheck = async (tokenToCheck) => {
    if (!vmUrl) return null;
    const result = await testBackendConnection({ url: vmUrl, token: tokenToCheck });
    setStatus(result);
    setChecked(true);
    return result;
  };

  // Re-verify automatically whenever Settings mounts (or the saved token/VM
  // URL changes) if a token is already saved - same pattern
  // VmConnectionSection already used. Without this, a token saved in a
  // PREVIOUS session shows "Not checked" every time you reopen Settings,
  // even though it's a real, working, already-persisted value - looks
  // like it silently reset when it never did.
  useEffect(() => {
    if (savedToken && vmUrl) runCheck(savedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedToken, vmUrl]);

  const isDirty = tokenValue.trim() !== savedToken;

  const handleTestAndSave = async () => {
    const token = tokenValue.trim();
    if (!token) return;
    if (!vmUrl) {
      Alert.alert('Set the VM IP first', 'Test & Save the Alibaba Cloud VM address above before testing the model API key.');
      return;
    }
    setTesting(true);
    const result = await runCheck(token);
    if (result.reachable && result.authValid) {
      await setBackendAuthToken(token);
      Alert.alert('Connected', `API key verified against ${result.model || ACTIVE_MODEL.label}.`);
    } else if (result.reachable && result.authValid === false) {
      Alert.alert('Invalid key', "That key doesn't match AUTH_TOKEN on the VM. Double-check server/config.js.");
    } else {
      Alert.alert('Connection failed', result.error || "Couldn't reach the VM to verify this key.");
    }
    setTesting(false);
  };

  // While the field has been edited away from the saved value, the LAST
  // check result no longer describes what's actually typed - show
  // "Unsaved" rather than a stale Verified/Invalid pill from a different
  // string. Once Test & Save runs again (or the edit is reverted back to
  // savedToken), this clears and the real result shows again.
  const pillColor = isDirty ? (theme.warningSoft || theme.accentSoft) : status.authValid ? (theme.successSoft || theme.accentSoft) : status.authValid === false ? theme.dangerSoft : (theme.warningSoft || theme.accentSoft);
  const pillTextColor = isDirty ? theme.warning : status.authValid ? theme.success : status.authValid === false ? theme.dangerText : theme.warning;
  const pillLabel = isDirty ? 'Unsaved' : !checked ? 'Not checked' : status.authValid ? 'Verified' : status.authValid === false ? 'Invalid' : 'Unknown';

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Model API key</Text>
        {savedToken ? (
          <View style={[styles.statusPill, { backgroundColor: pillColor }]}>
            <Text style={[styles.statusPillText, { color: pillTextColor }]}>{pillLabel}</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.statusPillText, { color: theme.textSecondary }]}>Not set</Text>
          </View>
        )}
      </View>

      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 8 }]}>
        This gates the VM itself - must match AUTH_TOKEN in the VM's server/config.js. It is NOT the model key; see OpenRouter API key below for that.
      </Text>
      <TextInput
        style={[styles.keyInput, { borderColor: theme.borderStrong, color: theme.textPrimary, marginTop: 8 }]}
        placeholder="Model API key"
        placeholderTextColor={theme.textTertiary}
        value={tokenValue}
        onChangeText={setTokenValue}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <View style={styles.keyRowButtons}>
        <TouchableOpacity
          style={[
            styles.keyPrimaryBtn,
            { backgroundColor: theme.accent },
            (!tokenValue.trim() || testing) && { backgroundColor: theme.borderStrong },
          ]}
          onPress={handleTestAndSave}
          disabled={!tokenValue.trim() || testing}
        >
          {testing
            ? <ActivityIndicator size="small" color={theme.textInverse} />
            : <Text style={[styles.keyPrimaryBtnText, { color: theme.textInverse }]}>Test & Save</Text>}
        </TouchableOpacity>
        {savedToken && !isDirty && (
          <TouchableOpacity style={styles.keySecondaryBtn} onPress={() => runCheck(savedToken)} disabled={testing}>
            <Text style={[styles.keySecondaryBtnText, { color: theme.textSecondary }]}>Check again</Text>
          </TouchableOpacity>
        )}
      </View>
      {isDirty && (
        <Text style={[styles.helperText, { color: theme.textTertiary, marginTop: 6, fontSize: 12 }]}>
          Unsaved - tap Test & Save to apply.
        </Text>
      )}
    </View>
  );
}

/**
 * The person's own OpenRouter API key (from https://openrouter.ai/keys) -
 * this is the key that actually reaches the model now (see this file's
 * header comment on VmConnectionSection above). Test & Save asks the VM to
 * check the key against OpenRouter directly (server/index.js's
 * /openrouter/key-status), the same "verify through the VM, don't call
 * the provider straight from the phone" shape ModelApiKeySection already
 * used - keeps the VM as the single place that ever talks to the model
 * provider, and reuses the existing VM-reachability requirement instead
 * of adding a second, parallel "can the phone reach the internet" check.
 */
function OpenRouterApiKeySection({ preferences, theme }) {
  const setOpenrouterApiKey = usePreferencesStore((s) => s.setOpenrouterApiKey);
  const savedKey = preferences?.openrouter_api_key || '';
  const vmUrl = preferences?.backend_vm_url || '';
  const vmToken = preferences?.backend_auth_token || '';
  const [keyValue, setKeyValue] = useState(savedKey);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState({ valid: null, limit: null, limitRemaining: null });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setKeyValue(savedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const runCheck = async (keyToCheck) => {
    if (!vmUrl) return null;
    const result = await testOpenRouterKey({ url: vmUrl, vmToken, openrouterKey: keyToCheck });
    setStatus(result);
    setChecked(true);
    return result;
  };

  // Re-verify automatically whenever Settings mounts (or the saved key/VM
  // URL changes) if a key is already saved - same reasoning as
  // ModelApiKeySection's identical effect just above: without this, a key
  // saved in a PREVIOUS session shows "Not checked" every time you reopen
  // Settings, even though it's the real, working, already-persisted key -
  // looks like it silently reset when it never did. Test & Save + this
  // effect together are what make it "permanently connected until you
  // change it," per how this screen is supposed to behave.
  useEffect(() => {
    if (savedKey && vmUrl) runCheck(savedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, vmUrl]);

  const isDirty = keyValue.trim() !== savedKey;

  const handleTestAndSave = async () => {
    const key = keyValue.trim();
    if (!key) return;
    if (!vmUrl) {
      Alert.alert('Set the VM IP first', 'Test & Save the Alibaba Cloud VM address above before testing the OpenRouter key.');
      return;
    }
    setTesting(true);
    const result = await runCheck(key);
    if (result.valid) {
      await setOpenrouterApiKey(key);
      const creditsNote = typeof result.limitRemaining === 'number' ? ` · ${result.limitRemaining} credits remaining` : '';
      Alert.alert('Connected', `OpenRouter key verified${creditsNote}.`);
    } else if (result.valid === false) {
      Alert.alert('Invalid key', result.error || "OpenRouter rejected this key. Double-check it at openrouter.ai/keys.");
    } else {
      Alert.alert('Check failed', result.error || "Couldn't reach the VM to verify this key.");
    }
    setTesting(false);
  };

  // Same isDirty-aware pill logic as ModelApiKeySection above - a value
  // that's been edited away from savedKey shows "Unsaved," not a stale
  // Verified/Invalid result that described a different string.
  const pillColor = isDirty ? (theme.warningSoft || theme.accentSoft) : status.valid ? (theme.successSoft || theme.accentSoft) : status.valid === false ? theme.dangerSoft : (theme.warningSoft || theme.accentSoft);
  const pillTextColor = isDirty ? theme.warning : status.valid ? theme.success : status.valid === false ? theme.dangerText : theme.warning;
  const pillLabel = isDirty ? 'Unsaved' : !checked ? 'Not checked' : status.valid ? 'Verified' : status.valid === false ? 'Invalid' : 'Unknown';

  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>OpenRouter API key</Text>
        {savedKey ? (
          <View style={[styles.statusPill, { backgroundColor: pillColor }]}>
            <Text style={[styles.statusPillText, { color: pillTextColor }]}>{pillLabel}</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.statusPillText, { color: theme.textSecondary }]}>Not set</Text>
          </View>
        )}
      </View>

      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 8 }]}>
        Your own key from openrouter.ai/keys. This is what the VM uses to reach {ACTIVE_MODEL.label} - chat, coding, vision, and video understanding all run through it.
      </Text>
      <TextInput
        style={[styles.keyInput, { borderColor: theme.borderStrong, color: theme.textPrimary, marginTop: 8 }]}
        placeholder="sk-or-v1-..."
        placeholderTextColor={theme.textTertiary}
        value={keyValue}
        onChangeText={setKeyValue}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <View style={styles.keyRowButtons}>
        <TouchableOpacity
          style={[
            styles.keyPrimaryBtn,
            { backgroundColor: theme.accent },
            (!keyValue.trim() || testing) && { backgroundColor: theme.borderStrong },
          ]}
          onPress={handleTestAndSave}
          disabled={!keyValue.trim() || testing}
        >
          {testing
            ? <ActivityIndicator size="small" color={theme.textInverse} />
            : <Text style={[styles.keyPrimaryBtnText, { color: theme.textInverse }]}>Test & Save</Text>}
        </TouchableOpacity>
        {savedKey && !isDirty && (
          <TouchableOpacity style={styles.keySecondaryBtn} onPress={() => runCheck(savedKey)} disabled={testing}>
            <Text style={[styles.keySecondaryBtnText, { color: theme.textSecondary }]}>Check again</Text>
          </TouchableOpacity>
        )}
      </View>
      {isDirty && (
        <Text style={[styles.helperText, { color: theme.textTertiary, marginTop: 6, fontSize: 12 }]}>
          Unsaved - tap Test & Save to apply.
        </Text>
      )}
    </View>
  );
}

function BackendConnectionSection({ preferences, theme }) {
  const [status, setStatus] = useState({ connected: false, ready: false, model: null });
  const [checking, setChecking] = useState(true);

  const check = async () => {
    setChecking(true);
    const result = await checkBackendHealth();
    setStatus(result);
    setChecking(false);
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.backend_vm_url, preferences?.backend_auth_token]);

  return (
    <View>
      <VmConnectionSection preferences={preferences} theme={theme} />
      <View style={{ height: 12 }} />
      <ModelApiKeySection preferences={preferences} theme={theme} />
      <View style={{ height: 12 }} />
      <OpenRouterApiKeySection preferences={preferences} theme={theme} />
      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 12 }]}>
        {status.ready
          ? `Chat, coding, reasoning, and the Terminal tool are all running on ${status.model || ACTIVE_MODEL.label} and bash/Python on the VM.`
          : status.connected
          ? 'The VM is reachable but the model is still loading - this can take a bit longer on first start.'
          : "ZAO couldn't reach the VM with these settings. Make sure the server is running on the VM and the IP/key above are correct."}
      </Text>
    </View>
  );
}

function MemorySection({ preferences, onToggle, theme, compact = false }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryCategory, setMemoryCategory] = useState('all');

  const memoryEnabled = preferences?.memory_enabled !== false;

  const loadMemories = async () => {
    setLoading(true);
    const result = await getAllMemories();
    setMemories(result.success ? result.data.filter((m) => m.is_active) : []);
    setLoading(false);
  };

  const memoryCategories = Array.from(new Set(memories.map((m) => m.category || 'general')));
  const filteredMemories = memories.filter((m) => {
    if (memoryCategory !== 'all' && (m.category || 'general') !== memoryCategory) return false;
    const q = memoryQuery.trim().toLowerCase();
    if (!q) return true;
    return String(m.content || '').toLowerCase().includes(q)
      || String(m.category || '').toLowerCase().includes(q);
  });

  const openModal = async () => {
    setModalVisible(true);
    await loadMemories();
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    await updateMemory(id, { content: trimmed });
    setEditingId(null);
    setEditingText('');
    await loadMemories();
  };

  const handleForget = async (id) => {
    await deactivateMemory(id);
    await loadMemories();
  };

  /**
   * Permanent delete (hardDeleteMemory) - distinct from handleForget's
   * soft deactivateMemory above. "Forget" keeps the row (is_active=0) so
   * upsertMemoryByContent's similarity check still has something to
   * compare a re-extracted duplicate against; this actually removes the
   * row, no undo, for when the person wants no trace of it at all (e.g.
   * something sensitive got picked up by accident). Confirmed separately
   * from "Forget" since the two have real different consequences.
   */
  const handleHardDelete = (id) => {
    Alert.alert(
      'Delete this memory?',
      'This removes it completely, right now - unlike "Forget", there\'s no trace kept at all. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await hardDeleteMemory(id);
            await loadMemories();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all memories?',
      'This permanently deletes everything ZAO remembers about you. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            await clearAllMemories();
            await loadMemories();
          },
        },
      ]
    );
  };

  const chrome = compact ? (
    <TouchableOpacity style={styles.navRow} onPress={() => { haptic.light(); openModal(); }}>
      <AppIconTile k="memory" size={30} />
      <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Memory</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  ) : (
    <>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Remember things about me</Text>
        <Switch
          value={memoryEnabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.fill, true: theme.switchTrack }}
          ios_backgroundColor={theme.fill}
        />
      </View>
      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 4 }]}>
        {memoryEnabled
          ? 'ZAO automatically picks up durable facts from your conversations (name, preferences, ongoing projects) and brings them into future chats, so you don\'t have to repeat yourself. Stored only on this device.'
          : 'Off - ZAO won\'t learn or recall anything about you across conversations. Memories already stored stay saved until you clear them below.'}
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>Manage memories</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={compact ? undefined : styles.keyRow}>
      {chrome}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Memory</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surfaceAlt }}>
              <Ionicons name="search" size={18} color={theme.textTertiary} />
              <TextInput
                style={{ flex: 1, color: theme.textPrimary, fontSize: 16 }}
                placeholder="Search memories"
                placeholderTextColor={theme.textTertiary}
                value={memoryQuery}
                onChangeText={setMemoryQuery}
                autoCapitalize="none"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
              {[{ id: 'all', label: 'All' }, ...memoryCategories.map((c) => ({ id: c, label: c }))].map((c) => {
                const on = memoryCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setMemoryCategory(c.id)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, backgroundColor: on ? theme.accentSoft : theme.surfaceAlt, borderColor: on ? theme.accent : theme.border }}
                  >
                    <Text style={{ color: on ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : memories.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              Nothing saved yet. As you chat with ZAO, things worth remembering will show up here.
            </Text>
          ) : filteredMemories.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              No memories match this search.
            </Text>
          ) : (
            <FlatList
              data={filteredMemories}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <View style={{ marginBottom: 6 }}>
                    <StatusPill theme={theme} tone="neutral" label={item.category || 'general'} />
                  </View>
                  {editingId === item.id ? (
                    <>
                      <TextInput
                        value={editingText}
                        onChangeText={setEditingText}
                        multiline
                        style={{ color: theme.textPrimary, fontSize: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 8, marginBottom: 8 }}
                      />
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <TouchableOpacity onPress={() => handleSaveEdit(item.id)}>
                          <Text style={{ color: theme.info, fontWeight: '600' }}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingId(null); setEditingText(''); }}>
                          <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: theme.textPrimary, fontSize: 15, marginBottom: 10 }}>{item.content}</Text>
                      <View style={{ flexDirection: 'row', gap: 20 }}>
                        <TouchableOpacity onPress={() => { setEditingId(item.id); setEditingText(item.content); }}>
                          <Text style={{ color: theme.info, fontWeight: '600' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleForget(item.id)}>
                          <Text style={{ color: theme.dangerText, fontWeight: '600' }}>Forget</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleHardDelete(item.id)}>
                          <Text style={{ color: theme.dangerText, fontWeight: '600', textDecorationLine: 'underline' }}>Delete permanently</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            />
          )}

          {memories.length > 0 && (
            <TouchableOpacity
              style={{ marginHorizontal: 20, marginBottom: 24, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.dangerBorder }}
              onPress={handleClearAll}
            >
              <Text style={{ color: theme.dangerText, fontWeight: '700' }}>Clear all memories</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

/**
 * Gives ZAO's prospective memory (src/services/reminders/reminderService.js)
 * the in-app view MEMORY_ARCHITECTURE.md originally called out as missing:
 * previously the only place a scheduled reminder was visible at all was
 * the system notification shade. Mirrors MemorySection's shape above -
 * a summary row + "Manage" opens a modal list - since this is the same
 * kind of "let the person see and edit ZAO's own persisted state" screen.
 */
function RemindersSection({ theme, compact = false }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReminders = async () => {
    setLoading(true);
    const result = await listReminders({ includeCompleted: true });
    setReminders(result.success ? result.data : []);
    setLoading(false);
  };

  const openModal = async () => {
    setModalVisible(true);
    await loadReminders();
  };

  const handleCancel = async (id) => {
    await cancelReminder(id);
    await loadReminders();
  };

  const handleForget = async (id) => {
    await forgetReminder(id);
    await loadReminders();
  };

  const activeCount = reminders.filter((r) => r.status === 'scheduled').length;

  const STATUS_STYLE = {
    scheduled: { label: 'Scheduled', color: theme.info },
    fired: { label: 'Delivered', color: theme.textSecondary },
    cancelled: { label: 'Cancelled', color: theme.textSecondary },
    failed: { label: 'Failed to schedule', color: theme.dangerText },
  };

  const chrome = compact ? (
    <TouchableOpacity style={styles.navRow} onPress={() => { haptic.light(); openModal(); }}>
      <AppIconTile k="reminders" size={30} />
      <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Reminders</Text>
      {activeCount > 0 ? <Text style={{ fontSize: 15, color: theme.textSecondary }}>{activeCount}</Text> : null}
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  ) : (
    <>
      <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Reminders</Text>
      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 4 }]}>
        Anything ZAO has scheduled to remind you about later, kept in ZAO's own records - inspectable and cancelable here even if the system notification never fires.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>
          Manage reminders{activeCount > 0 ? ` (${activeCount} active)` : ''}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={compact ? undefined : styles.keyRow}>
      {chrome}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Reminders</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : reminders.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              Nothing here yet. Ask ZAO to remind you about something and it'll show up here.
            </Text>
          ) : (
            <FlatList
              data={reminders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const statusInfo = STATUS_STYLE[item.status] || { label: item.status, color: theme.textSecondary };
                return (
                  <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusInfo.color, textTransform: 'uppercase' }}>
                        {statusInfo.label}{item.repeatRule ? ` \u00b7 ${item.repeatRule}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: theme.textPrimary, fontSize: 15, marginBottom: 6 }}>{item.message}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 10 }}>
                      {new Date(item.triggerAt).toLocaleString()}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 20 }}>
                      {item.status === 'scheduled' && (
                        <TouchableOpacity onPress={() => handleCancel(item.id)}>
                          <Text style={{ color: theme.dangerText, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      {item.status !== 'scheduled' && (
                        <TouchableOpacity onPress={() => handleForget(item.id)}>
                          <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const PERMISSION_MODE_INFO = {
  default: { label: 'Default', subtitle: 'Safe tools run free; edits and risky terminal commands need confirmation' },
  acceptEdits: { label: 'Accept edits', subtitle: 'File edits/creates/moves auto-run; deletes and terminal commands still confirm' },
  plan: { label: 'Plan', subtitle: 'Read-only - ZAO can look around and propose a plan, but nothing gets written or run' },
  auto: { label: 'Auto', subtitle: "Every edit and risky terminal command auto-runs. Catastrophic commands (rm -rf /, etc.) still can't run, in any mode" },
  bypassPermissions: { label: 'Bypass permissions', subtitle: 'Skip confirmation prompts. Distinct from Auto — Bypass never asks; Auto may still confirm high-risk actions.' },
};

function PermissionModeSection({ preferences, onSetMode, theme }) {
  const current = preferences?.permission_mode || 'default';
  return (
    <View>
      {PERMISSION_MODES.map((mode, i) => (
        <React.Fragment key={mode}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          <RadioOption
            label={PERMISSION_MODE_INFO[mode].label}
            subtitle={PERMISSION_MODE_INFO[mode].subtitle}
            selected={current === mode}
            onPress={() => onSetMode(mode)}
            theme={theme}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function PermissionModeSheet({ visible, onClose, preferences, onSetMode, theme }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Permission Mode</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
            <GlassFill theme={theme} radius={10} />
            <PermissionModeSection preferences={preferences} onSetMode={onSetMode} theme={theme} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CheckpointsSection({ theme, compact = false }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const load = async () => {
    setLoading(true);
    const result = await getRecentCheckpoints(50);
    setCheckpoints(result.success ? result.data : []);
    setLoading(false);
  };

  const openModal = async () => {
    setModalVisible(true);
    await load();
  };

  const handleRestore = (checkpoint) => {
    Alert.alert(
      'Restore this file?',
      `This overwrites the current contents of ${checkpoint.path} with what it was before this ${checkpoint.operation}. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoringId(checkpoint.id);
            const result = await rewindToCheckpoint(checkpoint.id);
            setRestoringId(null);
            if (!result.success) {
              Alert.alert('Could not restore', result.error?.message || 'Unknown error');
            }
            await load();
          },
        },
      ]
    );
  };

  const chrome = compact ? (
    <TouchableOpacity style={styles.navRow} onPress={() => { haptic.light(); openModal(); }}>
      <AppIconTile k="checkpoint" size={30} />
      <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Checkpoints</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  ) : (
    <>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        Every file edit ZAO makes is snapshotted first, so you can undo it later even without git.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>View recent checkpoints</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={compact ? undefined : styles.keyRow}>
      {chrome}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Checkpoints</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : checkpoints.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              No file edits have been snapshotted yet.
            </Text>
          ) : (
            <FlatList
              data={checkpoints}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
                    {item.operation} · {new Date(item.created_at).toLocaleString()}
                  </Text>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, marginBottom: 10 }} numberOfLines={2}>{item.path}</Text>
                  <TouchableOpacity onPress={() => handleRestore(item)} disabled={restoringId === item.id}>
                    {restoringId === item.id ? (
                      <ActivityIndicator size="small" color={theme.info} />
                    ) : (
                      <Text style={{ color: theme.info, fontWeight: '600' }}>Restore</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function HooksSection({ theme }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState('PreToolUse');
  const [newMatcher, setNewMatcher] = useState('*');
  const [newCommand, setNewCommand] = useState('');

  const load = async () => {
    setLoading(true);
    const result = await getHooks();
    setHooks(result.success ? result.data : []);
    setLoading(false);
  };

  const openModal = async () => {
    setModalVisible(true);
    await load();
  };

  const handleAdd = async () => {
    if (!newCommand.trim()) return;
    await createHook({
      id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      event: newEvent,
      matcher: newMatcher.trim() || '*',
      command: newCommand.trim(),
      backend: 'pc',
    });
    setNewCommand('');
    setShowAddForm(false);
    await load();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete this hook?', 'It will stop running immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteHook(id); await load(); } },
    ]);
  };

  return (
    <View style={styles.keyRow}>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        Real shell commands ZAO runs automatically at specific points - before/after a tool call, or once when a session starts. A PreToolUse hook can block the call it fires on.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>Manage hooks</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Hooks</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={hooks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>No hooks configured yet.</Text>}
              renderItem={({ item }) => (
                <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' }}>
                      {item.event} · {item.backend}
                    </Text>
                    <Switch
                      value={!!item.enabled}
                      onValueChange={(val) => setHookEnabled(item.id, val).then(load)}
                      trackColor={{ false: theme.fill, true: theme.switchTrack }}
          ios_backgroundColor={theme.fill}
                    />
                  </View>
                  <Text style={{ color: theme.textPrimary, fontSize: 13, marginBottom: 4 }}>matcher: {item.matcher}</Text>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, fontFamily: 'monospace', marginBottom: 10 }}>{item.command}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Text style={{ color: theme.dangerText, fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {showAddForm ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {['PreToolUse', 'PostToolUse', 'SessionStart'].map((ev) => (
                  <TouchableOpacity key={ev} onPress={() => setNewEvent(ev)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: newEvent === ev ? theme.accent : theme.border }}>
                    <Text style={{ color: newEvent === ev ? theme.accent : theme.textSecondary, fontSize: 12 }}>{ev}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={newMatcher}
                onChangeText={setNewMatcher}
                placeholder="Matcher (tool name or *)"
                placeholderTextColor={theme.textTertiary}
                style={{ color: theme.textPrimary, fontSize: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 8 }}
              />
              <TextInput
                value={newCommand}
                onChangeText={setNewCommand}
                placeholder="Shell command to run"
                placeholderTextColor={theme.textTertiary}
                style={{ color: theme.textPrimary, fontSize: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={handleAdd}><Text style={{ color: theme.info, fontWeight: '600' }}>Save hook</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddForm(false)}><Text style={{ color: theme.textSecondary }}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={{ marginHorizontal: 20, marginBottom: 24, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.accent }}
              onPress={() => setShowAddForm(true)}
            >
              <Text style={{ color: theme.accent, fontWeight: '700' }}>Add hook</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

function WorktreesSection({ theme }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await getWorktreeSessions('active');
    setSessions(result.success ? result.data : []);
    setLoading(false);
  };

  const openModal = async () => {
    setModalVisible(true);
    await load();
  };

  const handleClose = (session) => {
    Alert.alert(
      `Close "${session.branch}"?`,
      session.backend === 'pc_git_worktree'
        ? 'Was this branch already merged? If not, closing without merging just stops tracking it here - the branch itself is untouched either way.'
        : 'This stops tracking the session here. The GitHub branch itself is untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merged', onPress: async () => { await closeWorktreeSession(session, { merged: true }); await load(); } },
        { text: 'Not merged', style: 'destructive', onPress: async () => { await closeWorktreeSession(session, { merged: false }); await load(); } },
      ]
    );
  };

  return (
    <View style={styles.keyRow}>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        Parallel sessions on different branches - each one gets its own isolated chat conversation, so work on one doesn't step on another.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>View active worktrees</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Worktrees</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : sessions.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 }}>
              No active worktree sessions. Ask ZAO to split off a new branch to work on in parallel and it'll show up here.
            </Text>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
                    {item.backend} {item.repo ? `· ${item.owner}/${item.repo}` : ''}
                  </Text>
                  <Text style={{ color: theme.textPrimary, fontSize: 15, marginBottom: 10 }}>{item.branch}</Text>
                  <TouchableOpacity onPress={() => handleClose(item)}>
                    <Text style={{ color: theme.info, fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function AuditTrailSection({ preferences, onSetOtelEndpoint, theme, compact = false }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [spans, setSpans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otelValue, setOtelValue] = useState(preferences?.otel_export_endpoint || '');
  const [activityQuery, setActivityQuery] = useState('');
  const [activityStatus, setActivityStatus] = useState('all');

  const [usageEvents, setUsageEvents] = useState([]);
  const [usageCounts, setUsageCounts] = useState({});

  const load = async () => {
    setLoading(true);
    const [result, eventsResult, countsResult] = await Promise.all([
      getRecentSpans(100),
      getRecentUsageEvents(20),
      getUsageCounts(0),
    ]);
    setSpans(result || []);
    setUsageEvents(eventsResult?.data || []);
    setUsageCounts(countsResult?.data || {});
    setLoading(false);
  };

  const filteredSpans = spans.filter((item) => {
    if (activityStatus !== 'all' && item.status !== activityStatus) return false;
    const q = activityQuery.trim().toLowerCase();
    if (!q) return true;
    const name = String(item.tool_name || item.name || '').toLowerCase();
    return name.includes(q) || String(item.error_message || '').toLowerCase().includes(q);
  });

  const openModal = async () => {
    setModalVisible(true);
    await load();
  };

  const chrome = compact ? (
    <TouchableOpacity style={styles.navRow} onPress={() => { haptic.light(); openModal(); }}>
      <AppIconTile k="activity" size={30} />
      <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Agent Activity</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  ) : (
    <>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        A record of every tool call ZAO makes - what ran, with what, and whether it succeeded. Local-only unless you set an export endpoint below.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={openModal}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>View recent activity</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 16 }}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary, marginBottom: 6 }]}>OTel export endpoint (optional)</Text>
        <TextInput
          value={otelValue}
          onChangeText={setOtelValue}
          onBlur={() => onSetOtelEndpoint(otelValue.trim() || null)}
          placeholder="https://your-collector.example.com/v1/traces"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.keyInput, { color: theme.textPrimary, borderColor: theme.border }]}
        />
      </View>
    </>
  );

  return (
    <View style={compact ? undefined : styles.keyRow}>
      {chrome}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>Agent activity</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surfaceAlt }}>
              <Ionicons name="search" size={18} color={theme.textTertiary} />
              <TextInput
                style={{ flex: 1, color: theme.textPrimary, fontSize: 16 }}
                placeholder="Filter activity"
                placeholderTextColor={theme.textTertiary}
                value={activityQuery}
                onChangeText={setActivityQuery}
                autoCapitalize="none"
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {['all', 'ok', 'error', 'running'].map((s) => {
                const on = activityStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setActivityStatus(s)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, backgroundColor: on ? theme.accentSoft : theme.surfaceAlt, borderColor: on ? theme.accent : theme.border }}
                  >
                    <Text style={{ color: on ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {(!loading) ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textTertiary, textTransform: 'uppercase', marginBottom: 8 }}>
                Developer usage
              </Text>
              <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible', marginBottom: 10 }]}>
                <GlassFill theme={theme} radius={10} />
                <View style={styles.usageRow}>
                  <Text style={[styles.usageRowLabel, { color: theme.textPrimary }]}>Browser sessions</Text>
                  <Text style={[styles.usageRowValue, { color: theme.textSecondary }]}>{usageCounts.browser_session || 0}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.usageRow}>
                  <Text style={[styles.usageRowLabel, { color: theme.textPrimary }]}>GitHub pushes</Text>
                  <Text style={[styles.usageRowValue, { color: theme.textSecondary }]}>{usageCounts.github_push || 0}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.usageRow}>
                  <Text style={[styles.usageRowLabel, { color: theme.textPrimary }]}>Files / repos</Text>
                  <Text style={[styles.usageRowValue, { color: theme.textSecondary }]}>
                    {(usageCounts.file_created || 0) + (usageCounts.github_repo_created || 0)}
                  </Text>
                </View>
              </View>
              {usageEvents.length > 0 ? (
                <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible', marginBottom: 8 }]}>
                  <GlassFill theme={theme} radius={10} />
                  <Text style={[styles.helperText, { color: theme.textSecondary, marginBottom: 6, paddingHorizontal: 12, paddingTop: 10 }]}>
                    Recent usage_log events
                  </Text>
                  {usageEvents.slice(0, 8).map((event) => (
                    <View key={event.id} style={[styles.usageEventRow, { paddingHorizontal: 12 }]}>
                      <Text style={[styles.usageEventType, { color: theme.info }]}>{event.event_type}</Text>
                      {event.detail ? (
                        <Text style={[styles.helperText, { color: theme.textPrimary }]} numberOfLines={1}>{event.detail}</Text>
                      ) : null}
                      <Text style={[styles.helperText, { color: theme.textTertiary }]}>
                        {new Date(event.created_at).toLocaleTimeString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textTertiary, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 }}>
                Tool spans
              </Text>
            </View>
          ) : null}
          {loading ? (
            <ActivityIndicator size="large" color={theme.info} style={{ marginTop: 40 }} />
          ) : spans.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }}>
              Nothing logged yet - this fills in as ZAO makes tool calls.
            </Text>
          ) : filteredSpans.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }}>
              No activity matches this filter.
            </Text>
          ) : (
            <FlatList
              data={filteredSpans}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const tone = item.status === 'error' ? 'bad' : item.status === 'running' ? 'warn' : 'ok';
                return (
                  <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <AppIconTile k={item.tool_name || item.name || 'activity'} size={32} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' }}>
                          {new Date(item.started_at).toLocaleString()}
                        </Text>
                        <StatusPill theme={theme} tone={tone} label={item.status || 'ok'} />
                      </View>
                      <Text style={{ color: theme.textPrimary, fontSize: 14, marginTop: 4 }}>{item.tool_name || item.name}</Text>
                      {item.error_message ? <Text style={{ color: theme.dangerText, fontSize: 12, marginTop: 4 }}>{item.error_message}</Text> : null}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ title, theme }) {
  return <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{title}</Text>;
}

/**
 * "About ZAO" - Settings-level home for brainTypes.js's ZAO_BRAIN_PROFILE
 * and memoryTypes.js's MEMORY_TYPES/ZAO_MEMORY_PROFILE. Both files were
 * written as documentation-as-code for exactly this ("kept for any future
 * About ZAO's architecture settings panel" - see brainTypes.js's own
 * ZAO_BRAIN_PROFILE comment) but neither was ever actually imported
 * anywhere, unlike their sibling reasoningTypes.js (which already powers
 * ChatScreen.js's per-reply reasoning chip). Deliberately a static
 * reference panel rather than a per-message chip like reasoning's: brain
 * architecture and memory mechanisms don't vary turn-to-turn the way
 * which reasoning strategy handled one specific reply does - there's one
 * fixed answer for "how is ZAO built," not one per message.
 */
function ArchitectureSection({ theme }) {
  const [modalVisible, setModalVisible] = useState(false);

  const brainEntries = Object.keys(BRAIN_ARCHITECTURES).map((key) => {
    const value = BRAIN_ARCHITECTURES[key];
    return { value, label: BRAIN_ARCHITECTURE_LABELS[value], profile: ZAO_BRAIN_PROFILE[value] };
  });
  const memoryEntries = Object.values(MEMORY_TYPES).map((type) => ({
    ...type,
    summary: ZAO_MEMORY_PROFILE[type.key === 'working_memory_compaction' ? 'workingMemoryCompaction' : type.key === 'context_window' ? 'contextWindow' : type.key],
  }));

  return (
    <View style={styles.keyRow}>
      <Text style={[styles.helperText, { color: theme.textSecondary }]}>
        How ZAO's model is put to work, and what it remembers about you and how.
      </Text>
      <TouchableOpacity style={[styles.keyEditBtn, { marginTop: 12 }]} onPress={() => setModalVisible(true)}>
        <Text style={[styles.keyEditBtnText, { color: theme.info }]}>About ZAO's architecture</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: 56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary }}>About ZAO</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textTertiary, textTransform: 'uppercase', marginBottom: 10 }}>
              Brain architecture
            </Text>
            {brainEntries.map((entry) => (
              <View key={entry.value} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 }}>
                  {entry.label} {entry.profile?.implemented ? '' : '(not used by ZAO)'}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {entry.profile?.implemented ? entry.profile.where : entry.profile?.reason}
                </Text>
              </View>
            ))}

            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textTertiary, textTransform: 'uppercase', marginTop: 8, marginBottom: 10 }}>
              Memory
            </Text>
            {memoryEntries.map((entry) => (
              <View key={entry.key} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 }}>{entry.label}</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>{entry.summary || entry.definition}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function BrowserAgentSection({ preferences, theme }) {
  return (
    <View style={styles.keyRow}>
      <View style={styles.keyRowHeader}>
        <Text style={[styles.keyLabel, { color: theme.textPrimary }]}>Browser agent</Text>
        <View style={[styles.statusPill, { backgroundColor: preferences.browser_access_enabled ? (theme.successSoft || theme.accentSoft) : theme.surfaceAlt }]}>
          <Text style={[styles.statusPillText, { color: preferences.browser_access_enabled ? theme.success : theme.textSecondary }]}>
            {preferences.browser_access_enabled ? 'On' : 'Off'}
          </Text>
        </View>
      </View>
      <Text style={[styles.helperText, { color: theme.textSecondary, marginTop: 4 }]}>
        This runs a real browser on the Alibaba Cloud VM (see Server Connection
        above) and streams it live to your phone - the VM needs to be
        reachable for it to work. Turn this on or off anytime with the globe
        button in the chat composer. A small live view appears while it's
        on, so you can watch (or take over) whatever ZAO is doing.
      </Text>
    </View>
  );
}


function RadioOption({ label, subtitle, selected, onPress, theme, iconKey }) {
  return (
    <TouchableOpacity style={styles.modeOption} onPress={() => { haptic.select(); onPress?.(); }} accessibilityState={{ selected }}>
      <View style={styles.modeOptionLeft}>
        {iconKey ? <AppIconTile k={iconKey} size={30} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.modeTitle, { color: theme.textPrimary }]}>{label}</Text>
          {subtitle ? <Text style={[styles.modeSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {selected ? <Ionicons name="checkmark" size={20} color={theme.brand} /> : null}
      </View>
    </TouchableOpacity>
  );
}

function ManageUsageSheet({ visible, onClose, theme }) {
  const [softLimit, setSoftLimit] = useState(false);
  const [alertPercent, setAlertPct] = useState(80);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const prefs = await getUsageManagePrefs();
      setSoftLimit(!!prefs.softLimitEnabled);
      setAlertPct(prefs.alertPercent || 80);
      setLoaded(true);
    })();
  }, [visible]);

  const toggleSoft = async (v) => {
    haptic.select();
    setSoftLimit(v);
    await setSoftLimitEnabled(v);
  };

  const bumpAlert = async (delta) => {
    const next = Math.max(10, Math.min(100, (alertPercent || 80) + delta));
    setAlertPct(next);
    await setAlertPercent(next);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, glassSurface(theme, 16), { margin: 12, marginBottom: 28, overflow: 'visible', paddingBottom: 8 }]}>
          <GlassFill theme={theme} radius={16} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>Manage usage</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {!loaded ? (
            <ActivityIndicator style={{ margin: 24 }} color={theme.textTertiary} />
          ) : (
            <>
              <View style={[styles.navRow, { paddingHorizontal: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Soft limit alerts</Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                    Notify when weekly usage crosses your threshold
                  </Text>
                </View>
                <Switch
                  value={softLimit}
                  onValueChange={toggleSoft}
                  trackColor={{ false: theme.fill, true: theme.switchTrack }}
                  ios_backgroundColor={theme.fill}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border, marginHorizontal: 16 }]} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, opacity: softLimit ? 1 : 0.45 }}>
                <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Alert threshold</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2, marginBottom: 10 }}>
                  Soft ceiling — does not hard-block requests
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => softLimit && bumpAlert(-5)}
                    disabled={!softLimit}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.fill, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="remove" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: theme.textPrimary, minWidth: 64, textAlign: 'center' }}>
                    {alertPercent}%
                  </Text>
                  <TouchableOpacity
                    onPress={() => softLimit && bumpAlert(5)}
                    disabled={!softLimit}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.fill, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="add" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function UsageModal({ visible, onClose, theme, focus = 'usage' }) {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState({ percent: 0, resetsInDays: 7 });
  const [sub, setSub] = useState({ plan: 'Pro', priceLabel: null, period: 'month', renewsAt: null });
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setManageOpen(false);
    (async () => {
      setLoading(true);
      try {
        const [u, s] = await Promise.all([getWeeklyUsage(), getSubscription()]);
        setUsage(u);
        setSub(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const pct = Math.max(0, Math.min(100, Number(usage.percent) || 0));
  const resetsLabel = `Resets in ${usage.resetsInDays ?? 7} day${(usage.resetsInDays ?? 7) === 1 ? '' : 's'}`;
  const barColor = theme.info || theme.brand || '#0A84FF';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.usageScreenHeader}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={[styles.usageBackBtn, { backgroundColor: theme.fill || theme.surfaceAlt }]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.usageScreenTitle, { color: theme.textPrimary }]}>Usage</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={styles.usageLoadingBox}>
            <ActivityIndicator size="small" color={theme.textTertiary} />
          </View>
        ) : (
          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={[styles.card, glassSurface(theme, 14), { overflow: 'visible', marginTop: 8 }]}>
              <GlassFill theme={theme} radius={14} />
              <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary }}>Weekly usage limit</Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>{resetsLabel}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.fill || theme.border, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: barColor }} />
                </View>
                <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8 }}>{pct}%</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => { haptic.light(); setManageOpen(true); }}
              >
                <Text style={[styles.navRowLabel, { color: theme.textPrimary, flex: 1 }]}>Manage usage</Text>
                <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
              </TouchableOpacity>
            </View>

            <SectionHeader title="Subscription" theme={theme} />
            <View style={[styles.card, glassSurface(theme, 14), { overflow: 'visible' }]}>
              <GlassFill theme={theme} radius={14} />
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>{sub.plan || 'Pro'}</Text>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>{priceDisplay(sub)}</Text>
                <Text style={{ fontSize: 13, color: theme.textTertiary }}>
                  Renews {formatRenewsAt(sub.renewsAt)}
                  {sub.placeholder ? ' · placeholder' : ''}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Alert.alert('Manage subscription', 'Billing is not connected yet. Plan and price come from server config placeholders (ZAO_BILLING_PLAN_*).')}
              >
                <Text style={[styles.navRowLabel, { color: theme.textPrimary, flex: 1 }]}>Manage subscription</Text>
                <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Alert.alert('Change plan', 'No payment backend yet. Set ZAO_BILLING_PLAN_NAME / ZAO_BILLING_PLAN_PRICE_LABEL on the server to update this stub.')}
              >
                <Text style={[styles.navRowLabel, { color: theme.textPrimary, flex: 1 }]}>Change plan</Text>
                <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
              </TouchableOpacity>
            </View>
            {focus === 'subscription' ? (
              <Text style={[styles.helperText, { color: theme.textTertiary, marginHorizontal: 20, marginTop: 8 }]}>
                Example data until a billing provider is wired.
              </Text>
            ) : null}
          </ScrollView>
        )}
      </View>
      <ManageUsageSheet visible={manageOpen} onClose={() => setManageOpen(false)} theme={theme} />
    </Modal>
  );
}

export default function SettingsScreen({ onOpenSidebar, onGoChat }) {
  const theme = useTheme();
  const {
    preferences, loadPreferences,
    setMemoryEnabled, setPermissionMode, setOtelExportEndpoint,
  } = usePreferencesStore();
  const { themePreference, loadThemePreference, setThemePreference } = useThemeStore();

  const [usageModalVisible, setUsageModalVisible] = useState(false);
  const [usageFocus, setUsageFocus] = useState('usage');
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vpnOpen, setVpnOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [profileName, setProfileName] = useState('Account');
  const [accountSubtitle, setAccountSubtitle] = useState('Profile & connected accounts');
  const [integTrail, setIntegTrail] = useState({
    connectors: 'None',
    plugins: '0 installed',
    vault: '0 items',
    vpn: 'Off',
  });

  useEffect(() => {
    loadPreferences();
    loadThemePreference();
    migrateGithubTokenIntoVault(preferences?.github_username).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const memResult = await getAllMemories();
      const memories = memResult.success ? (memResult.data || []).filter((m) => m.is_active) : [];
      let vaultItems = 0;
      let pluginCount = 0;
      let vpnLabel = 'Off';
      let vpnOn = false;
      try {
        const vault = await getVaultSecuritySummary();
        vaultItems = vault?.data?.total || 0;
      } catch (_) {}
      try {
        const plugs = await listInstalledPlugins();
        pluginCount = (plugs?.data || []).length;
      } catch (_) {}
      try {
        const st = await vpn.status();
        const active = st?.data?.active || st?.active || null;
        if (active?.country || active?.countryCode) {
          vpnLabel = active.countryCode || active.country;
          vpnOn = true;
        } else if (active?.city) {
          vpnLabel = active.city;
          vpnOn = true;
        }
      } catch (_) {}
      if (cancelled) return;
      const name = resolveProfileName(preferences, memories);
      setProfileName(name);
      setAccountSubtitle(buildAccountSubtitle(preferences, { vaultItems, plugins: pluginCount, vpnOn }));
      const connectorBits = [];
      if (preferences?.github_username) connectorBits.push('GitHub');
      setIntegTrail({
        connectors: connectorBits.length ? connectorBits.join(', ') : 'None',
        plugins: `${pluginCount} installed`,
        vault: `${vaultItems} item${vaultItems === 1 ? '' : 's'}`,
        vpn: vpnLabel,
      });
    })();
    return () => { cancelled = true; };
  }, [
    preferences?.github_username,
    preferences?.memory_enabled,
    preferences?.openrouter_api_key,
    preferences?.backend_vm_url,
    preferences?.display_name,
    preferences?.user_name,
  ]);

  const NavRow = ({ iconKey, label, onPress, value }) => (
    <TouchableOpacity
      style={styles.navRow}
      onPress={() => { haptic.light(); onPress?.(); }}
    >
      <AppIconTile k={iconKey} size={30} />
      <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>{label}</Text>
      {value ? (
        <Text style={[styles.navRowValue, { color: theme.textSecondary }]} numberOfLines={1}>{value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
    </TouchableOpacity>
  );

  const permLabel = PERMISSION_MODE_INFO[preferences?.permission_mode || 'auto']?.label
    || PERMISSION_MODE_INFO.auto.label;
  const memoryEnabled = preferences?.memory_enabled !== false;

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        {onOpenSidebar && (
          <TouchableOpacity
            onPress={() => { haptic.light(); onOpenSidebar(); }}
            hitSlop={12}
            style={styles.headerIconButton}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="chevron-back" size={26} color={theme.brand} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>

      <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible', marginTop: 8 }]}>
        <GlassFill theme={theme} radius={10} />
        <TouchableOpacity
          style={styles.accountRow}
          onPress={() => { haptic.light(); setAccountOpen(true); }}
        >
          <AppIconTile k="account" size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.accountName, { color: theme.textPrimary }]}>{profileName}</Text>
            <Text style={[styles.accountSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {accountSubtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={theme.chevron} />
        </TouchableOpacity>
      </View>

      <SectionHeader title="Usage" theme={theme} />
      <UsageGroupCard
        theme={theme}
        onOpenUsage={() => { setUsageFocus('usage'); setUsageModalVisible(true); }}
        onOpenSubscription={() => { setUsageFocus('subscription'); setUsageModalVisible(true); }}
      />

      <SectionHeader title="Appearance" theme={theme} />
      <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
        <GlassFill theme={theme} radius={10} />
        <RadioOption
          label="Auto"
          subtitle="Follows your phone's setting"
          selected={themePreference === 'auto'}
          onPress={() => setThemePreference('auto')}
          theme={theme}
          iconKey="appearance_auto"
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <RadioOption
          label="Light"
          selected={themePreference === 'light'}
          onPress={() => setThemePreference('light')}
          theme={theme}
          iconKey="appearance_light"
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <RadioOption
          label="Dark"
          selected={themePreference === 'dark'}
          onPress={() => setThemePreference('dark')}
          theme={theme}
          iconKey="appearance_dark"
        />
      </View>

      <SectionHeader title="Integrations" theme={theme} />
      <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
        <GlassFill theme={theme} radius={10} />
        <NavRow iconKey="connectors" label="Connectors" onPress={() => setConnectorsOpen(true)} value={integTrail.connectors} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <NavRow iconKey="plugins" label="Plugins" onPress={() => setPluginsOpen(true)} value={integTrail.plugins} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <NavRow iconKey="vault" label="Vault" onPress={() => setVaultOpen(true)} value={integTrail.vault} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <NavRow iconKey="vpn" label="VPN" onPress={() => setVpnOpen(true)} value={integTrail.vpn} />
      </View>

      <SectionHeader title="Intelligence" theme={theme} />
      <View style={[styles.card, glassSurface(theme, 10), { overflow: 'visible' }]}>
        <GlassFill theme={theme} radius={10} />
        <View style={styles.navRow}>
          <AppIconTile k="remember" size={30} />
          <Text style={[styles.navRowLabel, { color: theme.textPrimary }]}>Remember things about me</Text>
          <Switch
            value={memoryEnabled}
            onValueChange={(v) => { haptic.select(); setMemoryEnabled(v); }}
            trackColor={{ false: theme.fill, true: theme.switchTrack }}
            ios_backgroundColor={theme.fill}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <NavRow iconKey="permissions" label="Permission Mode" onPress={() => setPermOpen(true)} value={permLabel} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <MemorySection preferences={preferences} onToggle={setMemoryEnabled} theme={theme} compact />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <RemindersSection theme={theme} compact />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <CheckpointsSection theme={theme} compact />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <AuditTrailSection preferences={preferences} onSetOtelEndpoint={setOtelExportEndpoint} theme={theme} compact />
      </View>
    </ScrollView>

    <UsageModal
      visible={usageModalVisible}
      onClose={() => setUsageModalVisible(false)}
      theme={theme}
      focus={usageFocus}
    />
    <AccountSheet
      visible={accountOpen}
      onClose={() => setAccountOpen(false)}
      theme={theme}
      preferences={preferences}
      profileName={profileName}
      subtitle={accountSubtitle}
    />
    <PermissionModeSheet
      visible={permOpen}
      onClose={() => setPermOpen(false)}
      preferences={preferences}
      onSetMode={setPermissionMode}
      theme={theme}
    />
    <ConnectorsHub
      visible={connectorsOpen}
      onClose={() => setConnectorsOpen(false)}
      theme={theme}
    />
    <VaultSheet
      visible={vaultOpen}
      onClose={() => setVaultOpen(false)}
      theme={theme}
    />
    <VpnSheet
      visible={vpnOpen}
      onClose={() => setVpnOpen(false)}
      theme={theme}
    />
    <PluginsHub
      visible={pluginsOpen}
      onClose={() => setPluginsOpen(false)}
      theme={theme}
      onGoChat={onGoChat}
    />
    </>
  );
}


const styles = StyleSheet.create({
    usageScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  usageBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageScreenTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  usageLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usageBigNumber: {
    fontSize: 32,
    fontWeight: '700',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  usageRowLabel: {
    fontSize: 14,
  },
  usageRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  usageHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  usageEventRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    gap: 2,
  },
  usageEventType: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncResultBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  syncResultLine: {
    fontSize: 12,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  headerIconButton: {
    marginLeft: -6,
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    lineHeight: 41,
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: -0.08,
    marginTop: 26,
    marginBottom: 7,
    marginLeft: 16,
  },
  card: {
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navRowLabel: {
    flex: 1,
    fontSize: 17,
    letterSpacing: -0.41,
  },
  navRowValue: {
    fontSize: 15,
    color: '#8E8E93',
    maxWidth: 120,
    textAlign: 'right',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.41,
  },
  accountSub: {
    fontSize: 13,
    marginTop: 2,
  },
  modeOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  modeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: 12,
  },
  modeTitle: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  modeSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 53,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  familyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 4,
  },
  familyChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  keyRow: {
    padding: 12,
  },
  keyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyLabel: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  keyRowButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  keySecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  keySecondaryBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  keyRemoveBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  keyPrimaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  keyPrimaryBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  keyEditBtn: {
    alignSelf: 'flex-start',
  },
  keyEditBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  helperText: {
    fontSize: 12,
    padding: 12,
    lineHeight: 17,
  },
  voiceSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  manageVoicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 6,
  },
  manageVoicesText: {
    fontWeight: '600',
    fontSize: 13,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  voiceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewButton: {
    padding: 4,
    marginLeft: 8,
  },
});
