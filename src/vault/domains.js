/**
 * Domain autocomplete + helpers for the Vault "Add credential" sheet.
 * Brand icons resolve via brandIconForWebsite (globe fallback, never letters).
 */

export const DOMAIN_SUGGESTIONS = [
  { domain: 'github.com', name: 'GitHub' },
  { domain: 'gmail.com', name: 'Gmail' },
  { domain: 'google.com', name: 'Google' },
  { domain: 'outlook.com', name: 'Outlook' },
  { domain: 'icloud.com', name: 'iCloud' },
  { domain: 'apple.com', name: 'Apple' },
  { domain: 'amazon.com', name: 'Amazon' },
  { domain: 'aws.amazon.com', name: 'AWS' },
  { domain: 'slack.com', name: 'Slack' },
  { domain: 'notion.so', name: 'Notion' },
  { domain: 'figma.com', name: 'Figma' },
  { domain: 'linear.app', name: 'Linear' },
  { domain: 'vercel.com', name: 'Vercel' },
  { domain: 'netlify.com', name: 'Netlify' },
  { domain: 'stripe.com', name: 'Stripe' },
  { domain: 'shopify.com', name: 'Shopify' },
  { domain: 'dropbox.com', name: 'Dropbox' },
  { domain: 'drive.google.com', name: 'Google Drive' },
  { domain: 'onedrive.live.com', name: 'OneDrive' },
  { domain: 'discord.com', name: 'Discord' },
  { domain: 'x.com', name: 'X' },
  { domain: 'twitter.com', name: 'Twitter' },
  { domain: 'linkedin.com', name: 'LinkedIn' },
  { domain: 'instagram.com', name: 'Instagram' },
  { domain: 'youtube.com', name: 'YouTube' },
  { domain: 'reddit.com', name: 'Reddit' },
  { domain: 'openai.com', name: 'OpenAI' },
  { domain: 'anthropic.com', name: 'Anthropic' },
  { domain: 'openrouter.ai', name: 'OpenRouter' },
  { domain: 'huggingface.co', name: 'Hugging Face' },
  { domain: 'docker.com', name: 'Docker' },
  { domain: 'cloudflare.com', name: 'Cloudflare' },
  { domain: 'azure.microsoft.com', name: 'Azure' },
  { domain: 'supabase.com', name: 'Supabase' },
  { domain: 'firebase.google.com', name: 'Firebase' },
  { domain: 'atlassian.net', name: 'Atlassian' },
  { domain: 'gitlab.com', name: 'GitLab' },
  { domain: 'bitbucket.org', name: 'Bitbucket' },
  { domain: 'paypal.com', name: 'PayPal' },
  { domain: 'spotify.com', name: 'Spotify' },
  { domain: 'zoom.us', name: 'Zoom' },
  { domain: 'todoist.com', name: 'Todoist' },
  { domain: 'asana.com', name: 'Asana' },
  { domain: 'trello.com', name: 'Trello' },
  { domain: 'clickup.com', name: 'ClickUp' },
  { domain: 'monday.com', name: 'Monday' },
  { domain: 'airtable.com', name: 'Airtable' },
  { domain: 'whop.com', name: 'Whop' },
];

export function normalizeWebsite(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
  return s.toLowerCase();
}

export function suggestDomains(query, limit = 8) {
  const q = normalizeWebsite(query);
  if (!q) return DOMAIN_SUGGESTIONS.slice(0, limit);
  const scored = DOMAIN_SUGGESTIONS
    .map((d) => {
      const dom = d.domain.toLowerCase();
      const name = d.name.toLowerCase();
      let score = 0;
      if (dom.startsWith(q)) score = 100;
      else if (name.startsWith(q)) score = 90;
      else if (dom.includes(q)) score = 70;
      else if (name.includes(q)) score = 60;
      return { ...d, score };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Phone dial codes with flag assets we ship. */
export const PHONE_COUNTRIES = [
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'NL', dial: '+31', name: 'Netherlands' },
  { code: 'JP', dial: '+81', name: 'Japan' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'BR', dial: '+55', name: 'Brazil' },
  { code: 'MX', dial: '+52', name: 'Mexico' },
  { code: 'IE', dial: '+353', name: 'Ireland' },
  { code: 'ES', dial: '+34', name: 'Spain' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'KR', dial: '+82', name: 'South Korea' },
  { code: 'NZ', dial: '+64', name: 'New Zealand' },
];

export function isValidEmail(email) {
  const s = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function isValidPhoneNational(national) {
  const digits = String(national || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
