import fs from 'fs';
import path from 'path';
import { iconFor, toolIconKey, AREA_ICONS, FALLBACK_ICON } from '../icons';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons', MaterialCommunityIcons: 'MDI' }));

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
  test('every glyph exists in its font family', () => {
    for (const e of [...Object.values(AREA_ICONS), FALLBACK_ICON]) {
      expect((e.family === 'mdi' ? MdiMap : IonMap)[e.glyph]).toBeDefined();
    }
  });
});

test('file extensions map to document marks', () => {
  const { fileIconKey } = require('../icons');
  expect(fileIconKey('a/Report.DOCX')).toBe('word');
  expect(fileIconKey('x.pdf')).toBe('pdf');
  expect(fileIconKey('noext')).toBe('files');
});
