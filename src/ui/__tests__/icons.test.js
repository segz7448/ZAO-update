import fs from 'fs';
import path from 'path';
import { iconFor, toolIconKey, vaultIconKey, AREA_ICONS, FALLBACK_ICON } from '../icons';
import { BRAND_ICONS, BRAND_KEY_FOR } from '../brandIcons';
import { CONNECTORS } from '../../connectors/registry';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons', MaterialCommunityIcons: 'MDI' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path', Circle: 'Circle' }));

const read = (p) => fs.readFileSync(path.join(__dirname, '../..', p), 'utf8');
const IonMap = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const MdiMap = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

describe('icon registry', () => {
  test('every planner domain has a registry entry', () => {
    const src = read('services/planning/executionPlanner.js');
    const valid = src.match(/const valid = \[([^\]]+)\]/)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
    expect(valid.length).toBeGreaterThan(5);
    for (const d of [...valid, 'planning']) expect(AREA_ICONS[d]).toBeDefined();
  });
  test('every orchestrator domainForTool area has a registry entry', () => {
    const src = read('services/toolOrchestrator.js');
    const body = src.slice(src.indexOf('function domainForTool'), src.indexOf('function eventTypeForTool'));
    const areas = [...body.matchAll(/return '([a-z_]+)'/g)].map((m) => m[1]);
    expect(areas.length).toBeGreaterThan(8);
    for (const a of areas) expect(AREA_ICONS[a]).toBeDefined();
  });
  test('every TOOL_REGISTRY tool resolves to a real (non-fallback) icon', () => {
    const src = read('services/toolOrchestrator.js');
    const tools = [...src.slice(src.indexOf('export const TOOL_REGISTRY')).matchAll(/^ {2}([a-z_0-9]+): \{/gm)].map((m) => m[1]);
    expect(tools.length).toBeGreaterThan(50);
    const missing = tools.filter((t) => iconFor(t).fallback);
    expect(missing).toEqual([]);
  });
  test('office tools get Word / Excel / PowerPoint marks', () => {
    expect(toolIconKey('docx_create')).toBe('word');
    expect(toolIconKey('xlsx_create')).toBe('excel');
    expect(toolIconKey('pptx_create')).toBe('powerpoint');
  });
  test('unknown keys get the polished fallback, never undefined', () => {
    expect(iconFor('quantum_teleport')).toBe(FALLBACK_ICON);
    expect(iconFor(null)).toBe(FALLBACK_ICON);
  });
  test('every glyph exists in its font family (brand entries skipped)', () => {
    for (const e of [...Object.values(AREA_ICONS), FALLBACK_ICON]) {
      if (e.brand) {
        expect(BRAND_ICONS[e.brand]).toBeDefined();
        expect(BRAND_ICONS[e.brand].path.length).toBeGreaterThan(20);
        continue;
      }
      expect((e.family === 'mdi' ? MdiMap : IonMap)[e.glyph]).toBeDefined();
    }
  });

  test('ZERO letter/text icon fallbacks in the registry', () => {
    const lettery = [];
    for (const [key, e] of Object.entries(AREA_ICONS)) {
      if (e.letter || e.text || e.badge || e.initials) lettery.push(key);
      if (e.brand) {
        if (!BRAND_ICONS[e.brand]?.path) lettery.push(`${key}:missing-brand-path`);
        continue;
      }
      if (!e.glyph) lettery.push(`${key}:no-glyph`);
      // Single A–Z character "glyph" is a letter badge
      if (typeof e.glyph === 'string' && /^[A-Za-z0-9]{1,3}$/.test(e.glyph) && !IonMap[e.glyph] && !MdiMap[e.glyph]) {
        lettery.push(`${key}:letter-glyph`);
      }
    }
    expect(lettery).toEqual([]);
    expect(FALLBACK_ICON.letter || FALLBACK_ICON.text || FALLBACK_ICON.badge).toBeFalsy();
    expect(FALLBACK_ICON.glyph).toBe('cube');
  });

  test('every connector icon is a brand SVG mark', () => {
    for (const c of CONNECTORS) {
      const e = iconFor(c.icon);
      expect(e.brand).toBeTruthy();
      expect(BRAND_ICONS[e.brand]?.path).toBeTruthy();
    }
  });

  test('vaultIconKey uses brand for known hosts, glyph otherwise — never letters', () => {
    expect(vaultIconKey({ type: 'login', website: 'https://github.com/foo' })).toBe('conn_github');
    expect(vaultIconKey({ type: 'login', website: 'https://obscure.example' })).toBe('vault_login');
    expect(vaultIconKey({ type: 'api_key' })).toBe('vault_api_key');
    expect(vaultIconKey({ type: 'secure_note' })).toBe('vault_secure_note');
    expect(iconFor(vaultIconKey({ type: 'login', website: 'https://obscure.example' })).glyph).toBe('globe');
  });

  test('BRAND_KEY_FOR maps every conn_* registry key', () => {
    for (const key of Object.keys(AREA_ICONS).filter((k) => k.startsWith('conn_'))) {
      expect(BRAND_KEY_FOR[key]).toBeTruthy();
      expect(BRAND_ICONS[BRAND_KEY_FOR[key]]).toBeDefined();
    }
  });
});

test('file extensions map to document marks', () => {
  const { fileIconKey } = require('../icons');
  expect(fileIconKey('a/Report.DOCX')).toBe('word');
  expect(fileIconKey('x.pdf')).toBe('pdf');
  expect(fileIconKey('noext')).toBe('files');
});
