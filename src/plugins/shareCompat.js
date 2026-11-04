/**
 * Pure shared-plugin compatibility checks (no native deps).
 */
export function checkSharedPluginCompatibility(snapshot, { knownTools, availableConnectorIds } = {}) {
  const reasons = [];
  const missingTools = [];
  const missingConnectors = [];
  if (!snapshot?.manifest) {
    return { ok: false, reasons: ['Missing plugin snapshot'], missingTools, missingConnectors };
  }
  if (snapshot.revoked) {
    return { ok: false, reasons: ['This share link was revoked by the owner'], missingTools, missingConnectors };
  }
  const m = snapshot.manifest;
  const tools = knownTools instanceof Set ? knownTools : new Set(knownTools || []);
  for (const t of m.allowedTools || []) {
    if (tools.size && !tools.has(t)) missingTools.push(t);
  }
  if (missingTools.length) {
    reasons.push(`Requires tools not in this app version: ${missingTools.join(', ')}`);
  }
  const connectors = new Set(availableConnectorIds || []);
  for (const c of m.requiredConnectors || []) {
    if (connectors.size && !connectors.has(c)) missingConnectors.push(c);
  }
  if (!m.name || !m.instructions || !(m.allowedTools || []).length) {
    reasons.push('Plugin manifest is incomplete or invalid');
  }
  return { ok: reasons.length === 0, reasons, missingTools, missingConnectors };
}
