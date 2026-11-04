import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Switch, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { GlassSheet, GlassCard, StatusPill } from '../../ui/GlassSheet';
import { AppIconTile, vaultIconKey } from '../../ui/icons';
import { haptic } from '../../ui/ios';
import {
  listVaultItems, getVaultSecuritySummary, revealVaultSecret,
  createVaultItem, updateVaultItem, deleteVaultItem, migrateGithubTokenIntoVault,
} from '../../vault/vaultService';
import {
  unlockVault, lockVault, getVaultLockState, subscribeVaultLock,
  ensureVaultAppStateWatcher, touchVaultActivity,
} from '../../vault/vaultAuth';
import { generatePassword } from '../../vault/generator';
import { scorePassword } from '../../vault/strength';
import { totp, totpProgress } from '../../vault/totp';
import { copySecret } from '../../vault/clipboard';
import { usePreferencesStore } from '../../store/preferencesStore';

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'login', label: 'Logins' },
  { id: 'api_key', label: 'API keys' },
  { id: 'secure_note', label: 'Notes' },
  { id: 'ssh_key', label: 'SSH' },
  { id: 'connector_token', label: 'Connectors' },
];


function strengthTone(score) {
  if (score <= 1) return 'bad';
  if (score === 2) return 'warn';
  if (score === 3) return 'info';
  return 'ok';
}

function formatRelative(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

function formatTotpCode(code) {
  const digits = String(code || '').replace(/\s/g, '');
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return code || '------';
}

/** Small countdown ring beside a large spaced code — never overflow the circle. */
function TotpRing({ remaining, step = 30, theme, code }) {
  const pct = totpProgress(remaining, step);
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <View style={styles.totpWrap}>
      <View style={styles.totpRingBox}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={theme.borderStrong}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={theme.accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={[styles.totpRemain, { color: theme.textSecondary }]}>{remaining}s</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.totpCode, { color: theme.textPrimary }]}>{formatTotpCode(code)}</Text>
        <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 2 }}>Authenticator code</Text>
      </View>
    </View>
  );
}

function GeneratorPanel({ theme, onUse }) {
  const [length, setLength] = useState(20);
  const [symbols, setSymbols] = useState(true);
  const [digits, setDigits] = useState(true);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const r = await generatePassword({ length, symbols, digits });
    setResult(r);
    setBusy(false);
    haptic.success();
  };

  useEffect(() => { run(); }, []);

  return (
    <GlassCard theme={theme}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <AppIconTile k="vault_generator" size={32} />
        <Text style={{ color: theme.textPrimary, fontSize: 17, fontWeight: '700' }}>Password generator</Text>
      </View>
      <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>Length · {length}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[12, 16, 20, 24, 32].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setLength(n)}
            style={[styles.chip, { backgroundColor: length === n ? theme.accentSoft : theme.surfaceAlt, borderColor: length === n ? theme.accent : theme.border }]}
          >
            <Text style={{ color: length === n ? theme.accent : theme.textSecondary, fontWeight: '600' }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.switchRow}>
        <Text style={{ color: theme.textPrimary }}>Digits</Text>
        <Switch value={digits} onValueChange={setDigits} trackColor={{ false: theme.fill, true: theme.switchTrack }} />
      </View>
      <View style={styles.switchRow}>
        <Text style={{ color: theme.textPrimary }}>Symbols</Text>
        <Switch value={symbols} onValueChange={setSymbols} trackColor={{ false: theme.fill, true: theme.switchTrack }} />
      </View>
      {result ? (
        <View style={{ marginTop: 12 }}>
          <Text selectable style={[styles.generated, { color: theme.textPrimary, borderColor: theme.borderStrong }]}>{result.password}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <StatusPill theme={theme} tone={strengthTone(result.strength.score)} label={result.strength.label} />
            <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{Math.round(result.entropyBits)} bits</Text>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, flex: 1 }]} onPress={run} disabled={busy}>
          <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.borderStrong, flex: 1 }]}
          onPress={async () => {
            if (!result) return;
            await copySecret(result.password);
            haptic.success();
          }}
        >
          <Text style={{ color: theme.info, fontWeight: '700' }}>Copy</Text>
        </TouchableOpacity>
      </View>
      {onUse && result ? (
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => onUse(result.password)}>
          <Text style={{ color: theme.accent, fontWeight: '600', textAlign: 'center' }}>Use this password</Text>
        </TouchableOpacity>
      ) : null}
    </GlassCard>
  );
}

function ItemDetail({ theme, item, onBack, onChanged }) {
  const [secret, setSecret] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [totpCode, setTotpCode] = useState(null);
  const [remaining, setRemaining] = useState(30);

  const loadSecret = async () => {
    const r = await revealVaultSecret(item.id, { reason: 'Reveal vault item' });
    if (!r.success) {
      Alert.alert('Locked', 'Unlock the vault to reveal this secret.');
      return;
    }
    setSecret(r.data);
    setRevealed(true);
    touchVaultActivity();
  };

  useEffect(() => {
    if (!secret?.totpSecret) return undefined;
    let cancelled = false;
    const tick = async () => {
      const t = await totp(secret.totpSecret);
      if (!cancelled) {
        setTotpCode(t.code);
        setRemaining(t.remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [secret?.totpSecret]);

  const doDelete = () => {
    if (item.managedByConnector) {
      Alert.alert('Managed by connector', 'Disconnect the connector to remove this token.');
      return;
    }
    Alert.alert('Delete item?', `Remove “${item.title}” permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteVaultItem(item.id);
          await onChanged?.();
          onBack();
        },
      },
    ]);
  };

  const passwordScore = secret?.password ? scorePassword(secret.password) : null;

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={18} color={theme.info} />
        <Text style={{ color: theme.info, fontWeight: '600' }}>All items</Text>
      </TouchableOpacity>

      <GlassCard theme={theme}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIconTile k={vaultIconKey(item)} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700' }}>{item.title}</Text>
            {item.username ? <Text style={{ color: theme.textSecondary, marginTop: 2 }}>{item.username}</Text> : null}
            {item.website ? <Text style={{ color: theme.textTertiary, fontSize: 13 }}>{item.website}</Text> : null}
          </View>
        </View>
        {item.managedByConnector ? (
          <View style={{ marginTop: 12 }}>
            <StatusPill theme={theme} tone="info" label="Managed by connector" />
          </View>
        ) : null}
        <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 12 }}>
          Last modified · {formatRelative(item.updatedAt)}
        </Text>
      </GlassCard>

      {!revealed ? (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={loadSecret}>
          <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Authenticate to reveal</Text>
        </TouchableOpacity>
      ) : (
        <GlassCard theme={theme}>
          {item.type === 'login' && (
            <>
              <MaskedField theme={theme} label="Password" value={secret?.password} />
              {passwordScore ? (
                <View style={{ marginTop: 8 }}>
                  <StatusPill theme={theme} tone={strengthTone(passwordScore.score)} label={passwordScore.label} />
                </View>
              ) : null}
              {secret?.totpSecret ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>One-time code</Text>
                  <TotpRing theme={theme} code={totpCode} remaining={remaining} />
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    onPress={async () => { if (totpCode) { await copySecret(totpCode); haptic.success(); } }}
                  >
                    <Text style={{ color: theme.info, fontWeight: '600', textAlign: 'center' }}>Copy code</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
          {(item.type === 'api_key' || item.type === 'connector_token') && (
            <MaskedField theme={theme} label="Token" value={secret?.token} />
          )}
          {item.type === 'secure_note' && (
            <MaskedField theme={theme} label="Note" value={secret?.body} multiline />
          )}
          {item.type === 'ssh_key' && (
            <>
              <MaskedField theme={theme} label="Private key" value={secret?.privateKey} multiline />
              {secret?.publicKey ? <MaskedField theme={theme} label="Public key" value={secret.publicKey} multiline /> : null}
            </>
          )}
        </GlassCard>
      )}

      {!item.managedByConnector ? (
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.dangerBorder, marginTop: 8 }]} onPress={doDelete}>
          <Text style={{ color: theme.dangerText, fontWeight: '700' }}>Delete</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function MaskedField({ theme, label, value, multiline }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={[styles.secretBox, { borderColor: theme.borderStrong }]}>
        <Text
          selectable
          style={{ color: theme.textPrimary, fontFamily: multiline ? 'monospace' : undefined, flex: 1 }}
        >
          {show ? (value || '') : '••••••••••••'}
        </Text>
        <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={8}>
          <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => { await copySecret(value || ''); haptic.success(); }}
          hitSlop={8}
          style={{ marginLeft: 10 }}
        >
          <Ionicons name="copy-outline" size={18} color={theme.info} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NewItemForm({ theme, onDone, onCancel }) {
  const [type, setType] = useState('login');
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [token, setToken] = useState('');
  const [body, setBody] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGen, setShowGen] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required');
      return;
    }
    setBusy(true);
    let secret = {};
    if (type === 'login') secret = { password, totpSecret: totpSecret.trim() || undefined };
    else if (type === 'api_key') secret = { token };
    else if (type === 'secure_note') secret = { body };
    else if (type === 'ssh_key') secret = { privateKey };
    const result = await createVaultItem({
      type,
      title: title.trim(),
      website: website.trim() || null,
      username: username.trim() || null,
      secret,
      hasTotp: !!totpSecret.trim(),
    });
    setBusy(false);
    if (result.success) {
      haptic.success();
      onDone();
    } else {
      Alert.alert('Could not save', result.error || 'Unknown error');
    }
  };

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {['login', 'api_key', 'secure_note', 'ssh_key'].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setType(t)}
            style={[styles.chip, { backgroundColor: type === t ? theme.accentSoft : theme.surfaceAlt, borderColor: type === t ? theme.accent : theme.border }]}
          >
            <Text style={{ color: type === t ? theme.accent : theme.textSecondary, fontWeight: '600' }}>
              {TYPE_FILTERS.find((f) => f.id === t)?.label || t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <GlassCard theme={theme}>
        <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="Title" placeholderTextColor={theme.textTertiary} value={title} onChangeText={setTitle} />
        {(type === 'login' || type === 'api_key') && (
          <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="Website" placeholderTextColor={theme.textTertiary} autoCapitalize="none" value={website} onChangeText={setWebsite} />
        )}
        {(type === 'login' || type === 'api_key') && (
          <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="Username" placeholderTextColor={theme.textTertiary} autoCapitalize="none" value={username} onChangeText={setUsername} />
        )}
        {type === 'login' && (
          <>
            <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="Password" placeholderTextColor={theme.textTertiary} secureTextEntry value={password} onChangeText={setPassword} />
            <TouchableOpacity onPress={() => setShowGen((v) => !v)} style={{ marginBottom: 10 }}>
              <Text style={{ color: theme.info, fontWeight: '600' }}>{showGen ? 'Hide generator' : 'Generate password'}</Text>
            </TouchableOpacity>
            {showGen ? <GeneratorPanel theme={theme} onUse={(p) => { setPassword(p); setShowGen(false); }} /> : null}
            <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="TOTP secret (optional)" placeholderTextColor={theme.textTertiary} autoCapitalize="none" value={totpSecret} onChangeText={setTotpSecret} />
          </>
        )}
        {type === 'api_key' && (
          <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary }]} placeholder="API key / token" placeholderTextColor={theme.textTertiary} secureTextEntry value={token} onChangeText={setToken} />
        )}
        {type === 'secure_note' && (
          <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary, minHeight: 100 }]} placeholder="Secure note" placeholderTextColor={theme.textTertiary} multiline value={body} onChangeText={setBody} />
        )}
        {type === 'ssh_key' && (
          <TextInput style={[styles.input, { borderColor: theme.borderStrong, color: theme.textPrimary, minHeight: 120, fontFamily: 'monospace' }]} placeholder="Private key" placeholderTextColor={theme.textTertiary} multiline value={privateKey} onChangeText={setPrivateKey} />
        )}
      </GlassCard>
      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]} onPress={save} disabled={busy}>
        <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 12 }} onPress={onCancel}>
        <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: '600' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

export function VaultSheet({ visible, onClose, theme }) {
  const [lock, setLock] = useState(getVaultLockState());
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const preferences = usePreferencesStore((s) => s.preferences);

  useEffect(() => {
    ensureVaultAppStateWatcher();
    return subscribeVaultLock(setLock);
  }, []);

  const refresh = useCallback(async () => {
    const listed = await listVaultItems({ type, query });
    setItems(listed.data || []);
    const sum = await getVaultSecuritySummary();
    setSummary(sum.data);
  }, [type, query]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      await migrateGithubTokenIntoVault(preferences?.github_username);
      await refresh();
    })();
  }, [visible, refresh, preferences?.github_username]);

  const unlock = async () => {
    const r = await unlockVault({ reason: 'Unlock ZAO Vault' });
    if (r.success) {
      haptic.success();
      await refresh();
    }
  };

  const userItems = items.filter((i) => !i.managedByConnector);
  const connectorItems = items.filter((i) => i.managedByConnector);

  return (
    <GlassSheet
      visible={visible}
      onClose={() => { lockVault(); onClose?.(); }}
      title="Vault"
      right={
        lock.unlocked ? (
          <TouchableOpacity onPress={() => { lockVault(); haptic.light(); }} hitSlop={8}>
            <Text style={{ color: theme.info, fontWeight: '600', marginRight: 8 }}>Lock</Text>
          </TouchableOpacity>
        ) : null
      }
    >
      {!lock.unlocked ? (
        <GlassCard theme={theme}>
          <AppIconTile k="vault" size={56} />
          <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 14 }}>Credential vault</Text>
          <Text style={{ color: theme.textSecondary, marginTop: 8, lineHeight: 20 }}>
            Secrets stay in the device Keychain. Unlock with biometrics or your device passcode.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, marginTop: 18 }]} onPress={unlock}>
            <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Unlock vault</Text>
          </TouchableOpacity>
        </GlassCard>
      ) : (
        <>
          <GlassCard theme={theme}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' }}>Security</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 34, fontWeight: '800', marginTop: 4 }}>{summary?.total ?? 0}</Text>
            <Text style={{ color: theme.textSecondary }}>items protected</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {(summary?.weakCount > 0) ? <StatusPill theme={theme} tone="warn" label={`${summary.weakCount} weak`} /> : <StatusPill theme={theme} tone="ok" label="No weak passwords" />}
              {(summary?.reusedCount > 0) ? <StatusPill theme={theme} tone="bad" label={`${summary.reusedCount} reused`} /> : <StatusPill theme={theme} tone="ok" label="No reuse" />}
              {(summary?.connectorManaged > 0) ? <StatusPill theme={theme} tone="info" label={`${summary.connectorManaged} connector`} /> : null}
            </View>
          </GlassCard>

          {creating ? (
            <NewItemForm theme={theme} onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />
          ) : selected ? (
            <ItemDetail theme={theme} item={selected} onBack={() => setSelected(null)} onChanged={refresh} />
          ) : showGenerator ? (
            <>
              <TouchableOpacity onPress={() => setShowGenerator(false)} style={{ marginBottom: 8 }}>
                <Text style={{ color: theme.info, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
              <GeneratorPanel theme={theme} />
            </>
          ) : (
            <>
              <View style={[styles.searchWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Ionicons name="search" size={18} color={theme.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search vault"
                  placeholderTextColor={theme.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.chips}>
                {TYPE_FILTERS.map((f) => {
                  const on = type === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => { haptic.select(); setType(f.id); }}
                      style={[styles.chip, { backgroundColor: on ? theme.accentSoft : theme.surfaceAlt, borderColor: on ? theme.accent : theme.border }]}
                    >
                      <Text style={{ color: on ? theme.accent : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, flex: 1 }]} onPress={() => setCreating(true)}>
                  <Text style={{ color: theme.textInverse, fontWeight: '700' }}>New item</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.borderStrong }]} onPress={() => setShowGenerator(true)}>
                  <Text style={{ color: theme.info, fontWeight: '700' }}>Generator</Text>
                </TouchableOpacity>
              </View>

              {userItems.length === 0 && connectorItems.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 30 }}>Vault is empty.</Text>
              ) : null}

              {userItems.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Items</Text>
                  <GlassCard theme={theme} style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
                    {userItems.map((item, i) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
                        onPress={() => { haptic.light(); setSelected(item); }}
                      >
                        <AppIconTile k={vaultIconKey(item)} size={32} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 16 }}>{item.title}</Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
                            {item.username || item.website || item.type}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.chevron} />
                      </TouchableOpacity>
                    ))}
                  </GlassCard>
                </>
              ) : null}

              {connectorItems.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Connector tokens</Text>
                  <GlassCard theme={theme} style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
                    {connectorItems.map((item, i) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
                        onPress={() => { haptic.light(); setSelected(item); }}
                      >
                        <AppIconTile k={vaultIconKey(item)} size={32} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 16 }}>{item.title}</Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Managed by connector</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.chevron} />
                      </TouchableOpacity>
                    ))}
                  </GlassCard>
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 12, marginBottom: 8, marginLeft: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1 },
  dangerBtn: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  generated: { fontFamily: 'monospace', fontSize: 15, borderWidth: 1, borderRadius: 10, padding: 12 },
  secretBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  totpWrap: { flexDirection: 'row', alignItems: 'center' },
  totpRingBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  totpRemain: { position: 'absolute', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totpCode: { fontSize: 28, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
});
