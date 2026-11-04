/**
 * Strip SYSTEM standing-context stamps that the planner sometimes glued into
 * goalSummary / titles when the date/time block was prefixed into the user turn.
 * Safe to run on any plan goal string; returns the cleaned human goal.
 */
const SYSTEM_TAG = /\[SYSTEM[^\]]*\]\s*:?\s*/gi;
const DATE_SENTENCE = /The real current date and time(?:, just checked,)? is [^.]*\.\s*/gi;
const OVERRIDES_PHRASE = /OVERRIDES YOUR OWN TRAINING[^.]*(?:\.|$)/gi;
const TRAINING_CUTOFF = /Your training data has a cutoff[\s\S]*?(?=\n\n|$)/gi;
const TRUST_ONLY = /Whenever your answer touches the date[\s\S]*?(?=\n\n|$)/gi;

export function sanitizePlanText(raw) {
  if (raw == null) return raw;
  let s = String(raw);
  if (!/SYSTEM|ALWAYS TRUE|real current date/i.test(s)) return s.trim();
  s = s.replace(SYSTEM_TAG, ' ');
  s = s.replace(OVERRIDES_PHRASE, ' ');
  s = s.replace(DATE_SENTENCE, ' ');
  s = s.replace(TRAINING_CUTOFF, ' ');
  s = s.replace(TRUST_ONLY, ' ');
  s = s.replace(/Do not say "as of my last update"[\s\S]*?(?=\n\n|$)/gi, ' ');
  s = s.replace(/If you're unsure whether something needs a live check[\s\S]*?(?=\n\n|$)/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // Drop a leftover leading colon/punctuation from "]: goal"
  s = s.replace(/^[:\-–—,]+\s*/, '').trim();
  return s || String(raw).trim();
}

export function looksContaminated(raw) {
  return /\[SYSTEM[^\]]*ALWAYS\s+TRUE/i.test(String(raw || ''))
    || /The real current date and time(?:, just checked)?/i.test(String(raw || ''));
}
