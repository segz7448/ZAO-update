import { CONNECTORS, searchConnectors, connectorById } from '../registry';
import { iconFor } from '../../ui/icons';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons', MaterialCommunityIcons: 'MDI' }));

describe('connector registry', () => {
  test('includes GitHub as live and required coming-soon brands', () => {
    expect(connectorById('github').wiring).toBe('live');
    for (const id of ['cloudflare', 'shopify', 'gmail', 'google_drive', 'outlook', 'onedrive', 'slack', 'notion', 'dropbox', 'vercel', 'stripe', 'google_calendar', 'linear']) {
      expect(connectorById(id)).toBeTruthy();
    }
  });

  test('every connector icon resolves without fallback', () => {
    const missing = CONNECTORS.filter((c) => iconFor(c.icon).fallback).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  test('search matches name and description', () => {
    expect(searchConnectors('git').some((c) => c.id === 'github')).toBe(true);
    expect(searchConnectors('zzzz-none')).toEqual([]);
  });
});
