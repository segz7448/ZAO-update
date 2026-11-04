/**
 * Vault — import existing credentials (no password generator).
 * Circular glass + adds: website autocomplete + brand icon, identifier
 * segments, optional 2FA / notes / tags, CSV import, live authenticator.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Switch, ScrollView, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile, brandIconForWebsite } from '../../ui/icons';
import { GlassFill, glassSurface, haptic } from '../../ui/ios';
import {
  listVaultItems, createVaultItem, deleteVaultItem, revealVaultSecret,
  getVaultSecuritySummary, listAuthenticatorItems,
} from '../../vault/vaultService';
import { unlockVault, requireVaultUnlock, getVaultLockState, subscribeVaultLock } from '../../vault/vaultAuth';
import { scorePassword, isWeakScore } from '../../vault/strength';
import { suggestDomains, normalizeWebsite, PHONE_COUNTRIES, isValidEmail } from '../../vault/domains';
import { parsePasswordCsv, importSelectionSummary } from '../../vault/importCsv';
import { parseOtpAuthUri, validateBase32Secret } from '../../vault/otpauth';
import { totp, totpProgress } from '../../vault/totp';
import { copySecret } from '../../vault/clipboard';

const ID_TYPES = [
  { id: 'email', label: 'Email' },
  { id: 'username', label: 'Username' },
  { id: 'phone', label: 'Phone' },
  { id: 'api_key', label: 'API key' },
];

function StrengthBadge({ theme, password }) {
  const s = scorePassword(password);
  const tone = s.score <= 1 ? 'bad' : s.score === 2 ? 'warn' : 'ok';
  return <StatusPill theme={theme} tone={tone} label={s.label} />;
}

function Segmented({ theme, value, options, onChange }) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.fillTertiary || theme.borderSubtle }]}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => { haptic.select(); onChange(o.id); }}
            style={[styles.segmentItem, on && { backgroundColor: theme.card || theme.fillPrimary, borderRadius: 9 }]}
          >
            <Text style={{ color: on ? theme.textPrimary : theme.textSecondary, fontWeight: on ? '700' : '600', fontSize: 12 }} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AddCredentialSheet({ visible, onClose, theme, onSaved }) {
  const [website, setWebsite] = useState('');
  const [idType, setIdType] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [extraType, setExtraType] = useState(null); // secure_note | ssh_key
  const [extraBody, setExtraBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [dial, setDial] = useState(PHONE_COUNTRIES[0]);
  const suggestions = useMemo(() => suggestDomains(website), [website]);
  const brandKey = brandIconForWebsite(website) || 'web';

  const reset = () => {
    setWebsite(''); setIdType('email'); setIdentifier(''); setPassword('');
    setNotes(''); setTags(''); setShow2fa(false); setTotpSecret('');
    setShowMore(false); setExtraType(null); setExtraBody('');
  };

  const save = async () => {
    const host = normalizeWebsite(website);
    if (!host && !extraType) {
      Alert.alert('Website required', 'Enter a website or app domain.');
      return;
    }
    if (idType === 'email' && identifier && !isValidEmail(identifier)) {
      Alert.alert('Invalid email', 'Check the email address.');
      return;
    }
    const totpCheck = show2fa && totpSecret ? validateBase32Secret(totpSecret) : { ok: true };
    if (show2fa && totpSecret && !totpCheck.ok) {
      Alert.alert('Invalid 2FA key', 'Setup key must be base32.');
      return;
    }
    setSaving(true);
    try {
      await requireVaultUnlock({ reason: 'Add credential' });
      if (extraType === 'secure_note') {
        await createVaultItem({
          type: 'secure_note',
          title: identifier || host || 'Secure note',
          website: host || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          secret: { note: extraBody || notes },
        });
      } else if (extraType === 'ssh_key') {
        await createVaultItem({
          type: 'ssh_key',
          title: identifier || host || 'SSH key',
          website: host || null,
          username: identifier || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          secret: { privateKey: extraBody, passphrase: password || undefined },
        });
      } else if (idType === 'api_key') {
        await createVaultItem({
          type: 'api_key',
          title: host || 'API key',
          website: host || null,
          username: identifier || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          secret: { token: password, note: notes || undefined },
        });
      } else {
        const username = idType === 'phone'
          ? `${dial.dial} ${identifier}`.trim()
          : identifier;
        await createVaultItem({
          type: 'login',
          title: host || username || 'Login',
          website: host || null,
          username,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          secret: {
            password,
            totpSecret: show2fa && totpCheck.ok && totpCheck.secret ? totpCheck.secret : undefined,
            note: notes || undefined,
            identifierType: idType,
          },
          hasTotp: !!(show2fa && totpSecret),
        });
      }
      haptic.success();
      reset();
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    }
    setSaving(false);
  };

  return (
    <GlassSheet visible={visible} onClose={onClose} title="Add credential">
      <View style={{ gap: 12 }}>
        <GlassCard theme={theme}>
          <Text style={labelStyle(theme)}>Website / app</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppIconTile k={brandKey} size={32} />
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder="github.com"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { flex: 1, color: theme.textPrimary, borderColor: theme.borderStrong }]}
            />
          </View>
          {suggestions.length ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {suggestions.slice(0, 5).map((s) => (
                <TouchableOpacity
                  key={s.domain}
                  onPress={() => setWebsite(s.domain)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                >
                  <AppIconTile k={brandIconForWebsite(s.domain) || 'web'} size={22} />
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{s.name} · {s.domain}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </GlassCard>

        {!extraType ? (
          <>
            <Text style={labelStyle(theme)}>Sign in with</Text>
            <Segmented theme={theme} value={idType} options={ID_TYPES} onChange={setIdType} />
            <GlassCard theme={theme}>
              {idType === 'phone' ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => {
                      const idx = PHONE_COUNTRIES.findIndex((c) => c.code === dial.code);
                      setDial(PHONE_COUNTRIES[(idx + 1) % PHONE_COUNTRIES.length]);
                    }}
                    style={[styles.dial, { borderColor: theme.borderStrong }]}
                  >
                    <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{dial.code} {dial.dial}</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                    placeholderTextColor={theme.textTertiary}
                    style={[styles.input, { flex: 1, color: theme.textPrimary, borderColor: theme.borderStrong }]}
                  />
                </View>
              ) : (
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={idType === 'email' ? 'name@example.com' : idType === 'api_key' ? 'Key name (optional)' : 'Username'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={idType === 'email' ? 'email-address' : 'default'}
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong }]}
                />
              )}
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={labelStyle(theme)}>{idType === 'api_key' ? 'Token' : 'Password'}</Text>
                  {password ? <StrengthBadge theme={theme} password={password} /> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={theme.textTertiary}
                    style={[styles.input, { flex: 1, color: theme.textPrimary, borderColor: theme.borderStrong }]}
                  />
                  <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                {password && isWeakScore(scorePassword(password).score) ? (
                  <Text style={{ color: theme.warning || '#FF9F0A', fontSize: 12, marginTop: 6 }}>
                    Weak password — consider a stronger one from your password manager.
                  </Text>
                ) : null}
              </View>
            </GlassCard>

            <TouchableOpacity onPress={() => setShow2fa((v) => !v)} style={styles.rowBetween}>
              <Text style={{ color: theme.info, fontWeight: '700' }}>{show2fa ? 'Hide 2FA' : 'Add 2FA'}</Text>
              <Ionicons name={show2fa ? 'chevron-up' : 'chevron-down'} size={18} color={theme.info} />
            </TouchableOpacity>
            {show2fa ? (
              <GlassCard theme={theme}>
                <Text style={labelStyle(theme)}>Authenticator setup key</Text>
                <TextInput
                  value={totpSecret}
                  onChangeText={setTotpSecret}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Base32 setup key"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong }]}
                />
                <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 6 }}>
                  Paste the setup key from your service. QR scanning is available from the Authenticator tab.
                </Text>
              </GlassCard>
            ) : null}

            <TouchableOpacity onPress={() => setShowMore((v) => !v)}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                {showMore ? 'Hide notes & tags' : 'Notes & tags'}
              </Text>
            </TouchableOpacity>
            {showMore ? (
              <GlassCard theme={theme}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes"
                  multiline
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong, minHeight: 72 }]}
                />
                <TextInput
                  value={tags}
                  onChangeText={setTags}
                  placeholder="Tags (comma-separated)"
                  autoCapitalize="none"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong, marginTop: 8 }]}
                />
              </GlassCard>
            ) : null}
          </>
        ) : (
          <GlassCard theme={theme}>
            <Text style={labelStyle(theme)}>{extraType === 'ssh_key' ? 'Private key' : 'Note'}</Text>
            <TextInput
              value={extraBody}
              onChangeText={setExtraBody}
              multiline
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong, minHeight: 120 }]}
            />
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Title"
              placeholderTextColor={theme.textTertiary}
              style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong, marginTop: 8 }]}
            />
          </GlassCard>
        )}

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[styles.primaryBtn, { backgroundColor: theme.info || '#0A84FF' }]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>}
        </TouchableOpacity>

        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 12, fontWeight: '600' }}>More types</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setExtraType(extraType === 'secure_note' ? null : 'secure_note')}
              style={[styles.chipBtn, { borderColor: theme.borderStrong }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Secure note</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExtraType(extraType === 'ssh_key' ? null : 'ssh_key')}
              style={[styles.chipBtn, { borderColor: theme.borderStrong }]}
            >
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>SSH key</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GlassSheet>
  );
}

function CsvImportSheet({ visible, onClose, theme, onImported }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const asset = res.assets[0];
      const resp = await fetch(asset.uri);
      const text = await resp.text();
      const parsed = parsePasswordCsv(text);
      if (!parsed.success) {
        Alert.alert('No logins found', parsed.error || 'Unrecognized CSV');
        return;
      }
      setItems(parsed.items || []);
      setSelected(new Set((parsed.items || []).map((_, i) => i)));
    } catch (e) {
      Alert.alert('Import failed', e?.message || 'Could not read file');
    }
  };

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const runImport = async () => {
    setBusy(true);
    try {
      await requireVaultUnlock({ reason: 'Import passwords' });
      let n = 0;
      for (const i of selected) {
        const row = items[i];
        if (!row) continue;
        await createVaultItem({
          type: 'login',
          title: row.name || row.url || row.username || 'Imported',
          website: normalizeWebsite(row.url) || null,
          username: row.username || null,
          tags: ['imported'],
          secret: { password: row.password || '', totpSecret: row.totp || undefined, note: row.notes },
          hasTotp: !!row.totp,
        });
        n += 1;
      }
      Alert.alert('Imported', n + ' credential' + (n === 1 ? '' : 's') + ' added.');
      onImported?.();
      onClose?.();
      setItems([]);
    } catch (e) {
      Alert.alert('Import failed', e?.message || 'Unknown error');
    }
    setBusy(false);
  };

  const selectedItems = items.map((it, i) => ({ ...it, selected: selected.has(i) }));
  const summary = importSelectionSummary(selectedItems);

  return (
    <GlassSheet visible={visible} onClose={onClose} title="Import CSV">
      <TouchableOpacity onPress={pick} style={[styles.primaryBtn, { backgroundColor: theme.info || '#0A84FF' }]}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Choose CSV file</Text>
      </TouchableOpacity>
      <Text style={{ color: theme.textTertiary, fontSize: 12, marginVertical: 10 }}>
        Supports Chrome, 1Password, Bitwarden, and LastPass exports.
      </Text>
      {items.length ? (
        <>
          <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>
            {summary.selected} selected · {summary.withTotp} with 2FA
          </Text>
          {items.map((row, i) => (
            <TouchableOpacity key={`${row.url}-${i}`} onPress={() => toggle(i)} style={{ marginBottom: 8 }}>
              <GlassCard theme={theme}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <AppIconTile k={brandIconForWebsite(row.url) || 'web'} size={28} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontWeight: '700' }} numberOfLines={1}>
                        {row.name || row.url || 'Login'}
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                        {row.username || '—'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={selected.has(i) ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected.has(i) ? (theme.info || '#0A84FF') : theme.textTertiary}
                  />
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            disabled={busy || !selected.size}
            onPress={runImport}
            style={[styles.primaryBtn, { backgroundColor: theme.info || '#0A84FF', opacity: selected.size ? 1 : 0.5 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Import selected</Text>}
          </TouchableOpacity>
        </>
      ) : null}
    </GlassSheet>
  );
}

function AuthenticatorPanel({ theme }) {
  const [items, setItems] = useState([]);
  const [codes, setCodes] = useState({});
  const [scanning, setScanning] = useState(false);
  const [setupKey, setSetupKey] = useState('');
  const [issuer, setIssuer] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const handledQr = useRef(false);

  const reload = useCallback(async () => {
    const r = await listAuthenticatorItems();
    setItems(r.data || []);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = {};
      for (const item of items) {
        try {
          const revealed = await revealVaultSecret(item.id, { reason: 'totp' });
          const secret = revealed?.data?.secret || revealed?.data;
          if (secret?.secret) {
            const code = await totp(secret.secret, {
              algorithm: secret.algorithm,
              digits: secret.digits,
              period: secret.period,
            });
            next[item.id] = { code, progress: totpProgress(undefined, secret.period || 30) };
          }
        } catch (_) { /* locked or missing */ }
      }
      if (alive) setCodes(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(id); };
  }, [items]);

  const addFromUri = async (uri) => {
    const parsed = parseOtpAuthUri(uri);
    if (!parsed.success || !parsed.data) {
      Alert.alert('Invalid QR', parsed.error || 'Could not parse otpauth URI');
      return;
    }
    const d = parsed.data;
    await requireVaultUnlock({ reason: 'Add authenticator' });
    await createVaultItem({
      type: 'authenticator',
      title: d.label || d.issuer || 'Authenticator',
      website: d.issuer || null,
      username: d.account || d.label || null,
      issuer: d.issuer || null,
      hasTotp: true,
      secret: {
        secret: d.secret,
        algorithm: d.algorithm,
        digits: d.digits,
        period: d.period,
        otpType: d.type || 'totp',
        counter: d.counter,
      },
    });
    setScanning(false);
    reload();
  };

  const addFromKey = async () => {
    const v = validateBase32Secret(setupKey);
    if (!v.ok) {
      Alert.alert('Invalid key', 'Setup key must be base32.');
      return;
    }
    await requireVaultUnlock({ reason: 'Add authenticator' });
    await createVaultItem({
      type: 'authenticator',
      title: issuer || 'Authenticator',
      issuer: issuer || null,
      hasTotp: true,
      secret: { secret: v.secret, otpType: 'totp', period: 30, digits: 6, algorithm: 'SHA1' },
    });
    setSetupKey('');
    setIssuer('');
    reload();
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={async () => {
            handledQr.current = false;
            if (!permission?.granted) {
              const r = await requestPermission();
              if (!r.granted) {
                Alert.alert('Camera needed', 'Allow camera access to scan authenticator QR codes.');
                return;
              }
            }
            setScanning(true);
          }}
          style={[styles.chipBtn, { borderColor: theme.borderStrong }]}
        >
          <Text style={{ color: theme.info, fontWeight: '700' }}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {scanning ? (
        <View style={{ height: 240, borderRadius: 16, overflow: 'hidden' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handledQr.current) return;
              handledQr.current = true;
              addFromUri(data);
            }}
          />
          <TouchableOpacity onPress={() => setScanning(false)} style={{ position: 'absolute', top: 10, right: 10 }}>
            <StatusPill theme={theme} tone="neutral" label="Close" />
          </TouchableOpacity>
        </View>
      ) : null}

      <GlassCard theme={theme}>
        <Text style={labelStyle(theme)}>Or enter setup key</Text>
        <TextInput
          value={issuer}
          onChangeText={setIssuer}
          placeholder="Issuer (e.g. GitHub)"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong }]}
        />
        <TextInput
          value={setupKey}
          onChangeText={setSetupKey}
          placeholder="Base32 setup key"
          autoCapitalize="characters"
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.borderStrong, marginTop: 8 }]}
        />
        <TouchableOpacity onPress={addFromKey} style={{ marginTop: 10 }}>
          <Text style={{ color: theme.info, fontWeight: '700' }}>Add account</Text>
        </TouchableOpacity>
      </GlassCard>

      {items.map((item) => {
        const c = codes[item.id];
        return (
          <GlassCard key={item.id} theme={theme}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{item.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.issuer || item.website || ''}</Text>
              </View>
              <TouchableOpacity onPress={() => c?.code && copySecret(c.code)}>
                <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 22, fontVariant: ['tabular-nums'] }}>
                  {c?.code || '••••••'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        );
      })}
    </View>
  );
}

function VaultListItem({ theme, item, onReveal, onDelete }) {
  const brand = brandIconForWebsite(item.website) || 'web';
  const idLabel = item.username || (item.type === 'api_key' ? 'API key' : item.type);
  return (
    <GlassCard theme={theme}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppIconTile k={brand} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textPrimary, fontWeight: '700' }} numberOfLines={1}>
            {item.title || item.website || 'Item'}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
            {item.website ? `${item.website} · ` : ''}{idLabel}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <StatusPill theme={theme} tone="neutral" label={item.type} />
            {item.hasTotp ? <StatusPill theme={theme} tone="info" label="2FA" /> : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => onReveal(item)} hitSlop={8}>
          <Ionicons name="eye-outline" size={22} color={theme.info || '#0A84FF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(item)} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={theme.dangerText || '#FF453A'} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

export function VaultSheet({ visible, onClose, theme }) {
  const [locked, setLocked] = useState(!getVaultLockState().unlocked);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('items'); // items | authenticator
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeVaultLock(() => setLocked(!getVaultLockState().unlocked)), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const listed = await listVaultItems({ includeConnectorManaged: true });
      setItems(listed.data || []);
      const sum = await getVaultSecuritySummary();
      setSummary(sum.data || null);
    } catch (_) { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible && !locked) reload();
  }, [visible, locked, reload]);

  const onUnlock = async () => {
    const r = await unlockVault({ reason: 'Unlock Vault' });
    if (!r.success) Alert.alert('Unlock failed', r.error || 'Could not unlock');
  };

  const onReveal = async (item) => {
    try {
      await requireVaultUnlock({ reason: 'Reveal secret' });
      const r = await revealVaultSecret(item.id, { reason: 'reveal' });
      const secret = r?.data?.secret || r?.data || {};
      const value = secret.password || secret.token || secret.note || secret.privateKey || JSON.stringify(secret);
      Alert.alert(item.title || 'Secret', String(value).slice(0, 500), [
        { text: 'Copy', onPress: () => copySecret(String(value)) },
        { text: 'OK' },
      ]);
    } catch (e) {
      Alert.alert('Locked', e?.message || 'Unlock required');
    }
  };

  const onDelete = (item) => {
    Alert.alert('Delete?', item.title || 'Item', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await requireVaultUnlock({ reason: 'Delete vault item' });
          await deleteVaultItem(item.id);
          reload();
        },
      },
    ]);
  };

  return (
    <>
      <GlassSheet
        visible={visible}
        onClose={onClose}
        title="Vault"
        right={
          !locked ? (
            <TouchableOpacity
              onPress={() => { haptic.light(); setAddOpen(true); }}
              style={styles.plusWrap}
            >
              <View style={[styles.plusCircle, glassSurface(theme, 1)]}>
                <GlassFill theme={theme} radius={22} strong />
                <Ionicons name="add" size={24} color={theme.textPrimary} />
              </View>
            </TouchableOpacity>
          ) : null
        }
        scroll={false}
      >
        {locked ? (
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 16 }}>
            <AppIconTile k="vault" size={56} />
            <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 18 }}>Vault is locked</Text>
            <TouchableOpacity onPress={onUnlock} style={[styles.primaryBtn, { backgroundColor: theme.info || '#0A84FF', paddingHorizontal: 28 }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Unlock</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Segmented
              theme={theme}
              value={tab}
              options={[{ id: 'items', label: 'Logins' }, { id: 'authenticator', label: 'Authenticator' }]}
              onChange={setTab}
            />
            {summary ? (
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, flexWrap: 'wrap' }}>
                <StatusPill theme={theme} tone="neutral" label={`${summary.total ?? items.length} items`} />
                {summary.weakCount ? <StatusPill theme={theme} tone="warn" label={`${summary.weakCount} weak`} /> : null}
                {summary.reusedCount ? <StatusPill theme={theme} tone="bad" label={`${summary.reusedCount} reused`} /> : null}
              </View>
            ) : null}
            <TouchableOpacity onPress={() => setImportOpen(true)} style={{ marginBottom: 10 }}>
              <Text style={{ color: theme.info, fontWeight: '700' }}>Import CSV…</Text>
            </TouchableOpacity>
            {loading ? <ActivityIndicator color={theme.info} /> : null}
            {tab === 'items' ? (
              <FlatList
                data={items.filter((i) => i.type !== 'authenticator')}
                keyExtractor={(i) => i.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={
                  <GlassCard theme={theme}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>No credentials yet</Text>
                    <Text style={{ color: theme.textSecondary, marginTop: 6 }}>
                      Tap + to import a login you already have, or import a CSV from Chrome / 1Password / Bitwarden / LastPass.
                    </Text>
                  </GlassCard>
                }
                renderItem={({ item }) => (
                  <View style={{ marginBottom: 10 }}>
                    <VaultListItem theme={theme} item={item} onReveal={onReveal} onDelete={onDelete} />
                  </View>
                )}
              />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <AuthenticatorPanel theme={theme} />
              </ScrollView>
            )}
          </View>
        )}
      </GlassSheet>

      <AddCredentialSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        theme={theme}
        onSaved={reload}
      />
      <CsvImportSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        theme={theme}
        onImported={reload}
      />
    </>
  );
}

function labelStyle(theme) {
  return { color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 };
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 11, gap: 2 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  chipBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dial: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  plusWrap: { marginRight: 4 },
  plusCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
});
