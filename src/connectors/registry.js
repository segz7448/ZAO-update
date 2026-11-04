/**
 * ZAO connector registry — one source of truth for every third-party
 * connector shown in Settings > Connectors. Icons resolve through
 * src/ui/icons.js (AppIconTile). Wiring beyond GitHub is layout-only
 * for now ("Coming soon"); GitHub reuses the real OAuth / PAT paths.
 */
export const CONNECTOR_CATEGORIES = [
  { id: 'developer', label: 'Developer' },
  { id: 'email', label: 'Email' },
  { id: 'storage', label: 'Storage' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'productivity', label: 'Productivity' },
];

/**
 * @typedef {object} ConnectorDef
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} icon  registry key in AREA_ICONS / connector icons
 * @property {string} description
 * @property {string[]} capabilities  what ZAO can do once connected
 * @property {'live'|'coming_soon'} wiring
 * @property {string} [brandColor]
 * @property {string} [website]
 */

/** @type {ConnectorDef[]} */
export const CONNECTORS = [
  {
    id: 'github',
    name: 'GitHub',
    category: 'developer',
    icon: 'conn_github',
    brandColor: '#1F2328',
    website: 'https://github.com',
    description: 'Repos, issues, pull requests, Actions, and commits under your account.',
    capabilities: [
      'Create and list repositories',
      'Commit and push files',
      'Open pull requests and releases',
      'Trigger and inspect Actions workflows',
    ],
    wiring: 'live',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'developer',
    icon: 'conn_cloudflare',
    brandColor: '#F6821F',
    website: 'https://cloudflare.com',
    description: 'DNS, Workers, Pages, and edge config for your Cloudflare account.',
    capabilities: ['Manage DNS records', 'Deploy Workers and Pages', 'Read analytics'],
    wiring: 'coming_soon',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'developer',
    icon: 'conn_vercel',
    brandColor: '#000000',
    website: 'https://vercel.com',
    description: 'Deployments, projects, and environment variables on Vercel.',
    capabilities: ['List projects', 'Trigger deployments', 'Read deployment status'],
    wiring: 'coming_soon',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'developer',
    icon: 'conn_linear',
    brandColor: '#5E6AD2',
    website: 'https://linear.app',
    description: 'Issues, projects, and cycles from your Linear workspace.',
    capabilities: ['Create and update issues', 'List projects and cycles', 'Search issues'],
    wiring: 'coming_soon',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'email',
    icon: 'conn_gmail',
    brandColor: '#EA4335',
    website: 'https://mail.google.com',
    description: 'Read, search, and send mail in your Gmail inbox.',
    capabilities: ['Search and read threads', 'Send and reply', 'Manage labels'],
    wiring: 'coming_soon',
  },
  {
    id: 'outlook',
    name: 'Outlook Mail',
    category: 'email',
    icon: 'conn_outlook',
    brandColor: '#0078D4',
    website: 'https://outlook.live.com',
    description: 'Outlook / Microsoft 365 mail for reading and sending.',
    capabilities: ['Search and read messages', 'Send and reply', 'Manage folders'],
    wiring: 'coming_soon',
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'storage',
    icon: 'conn_google_drive',
    brandColor: '#4285F4',
    website: 'https://drive.google.com',
    description: 'Files and folders in Google Drive.',
    capabilities: ['List and search files', 'Upload and download', 'Share links'],
    wiring: 'coming_soon',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    category: 'storage',
    icon: 'conn_onedrive',
    brandColor: '#0078D4',
    website: 'https://onedrive.live.com',
    description: 'Files and folders in Microsoft OneDrive.',
    capabilities: ['List and search files', 'Upload and download', 'Share links'],
    wiring: 'coming_soon',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'storage',
    icon: 'conn_dropbox',
    brandColor: '#0061FF',
    website: 'https://www.dropbox.com',
    description: 'Files in your Dropbox account.',
    capabilities: ['List and search files', 'Upload and download', 'Share links'],
    wiring: 'coming_soon',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'commerce',
    icon: 'conn_shopify',
    brandColor: '#96BF48',
    website: 'https://www.shopify.com',
    description: 'Products, orders, and store data for a Shopify shop.',
    capabilities: ['List products and orders', 'Update inventory', 'Read analytics'],
    wiring: 'coming_soon',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'commerce',
    icon: 'conn_stripe',
    brandColor: '#635BFF',
    website: 'https://stripe.com',
    description: 'Payments, customers, and subscriptions via Stripe.',
    capabilities: ['List customers and charges', 'Create payment links', 'Read balance'],
    wiring: 'coming_soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'productivity',
    icon: 'conn_slack',
    brandColor: '#4A154B',
    website: 'https://slack.com',
    description: 'Channels and messages in your Slack workspace.',
    capabilities: ['List channels', 'Send and read messages', 'Search conversations'],
    wiring: 'coming_soon',
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'productivity',
    icon: 'conn_notion',
    brandColor: '#000000',
    website: 'https://www.notion.so',
    description: 'Pages and databases in your Notion workspace.',
    capabilities: ['Search pages', 'Create and update pages', 'Query databases'],
    wiring: 'coming_soon',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'productivity',
    icon: 'conn_google_calendar',
    brandColor: '#4285F4',
    website: 'https://calendar.google.com',
    description: 'Events and calendars in Google Calendar.',
    capabilities: ['List upcoming events', 'Create and update events', 'Check free/busy'],
    wiring: 'coming_soon',
  },
];

export function connectorById(id) {
  return CONNECTORS.find((c) => c.id === id) || null;
}

export function connectorsByCategory(categoryId) {
  return CONNECTORS.filter((c) => c.category === categoryId);
}

export function searchConnectors(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return CONNECTORS.slice();
  return CONNECTORS.filter((c) =>
    c.name.toLowerCase().includes(q)
    || c.description.toLowerCase().includes(q)
    || c.category.toLowerCase().includes(q)
    || c.capabilities.some((cap) => cap.toLowerCase().includes(q))
  );
}
