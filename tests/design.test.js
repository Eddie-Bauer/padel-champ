// Rules of the design system that can be checked without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const jsFiles = [...readdirSync(new URL('js/', root)).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...readdirSync(new URL('js/views/', root)).map(f => 'js/views/' + f)];

test('the page loads tokens, components and app layout, in that order', () => {
  const html = read('index.html');
  const order = ['ds/tokens.css', 'ds/bundle.css', 'css/app.css'].map(f => html.indexOf(`href="${f}"`));
  assert.ok(order.every(i => i > 0), 'a stylesheet is missing');
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(!html.includes('fonts.googleapis.com'), 'fonts must be local');
});

test('every font the tokens name is in the repo', () => {
  const fonts = [...read('ds/tokens.css').matchAll(/url\("(fonts\/[^"]+)"\)/g)].map(m => m[1]);
  assert.equal(fonts.length, 4);
  for (const f of fonts) assert.ok(existsSync(new URL('ds/' + f, root)), f);
});

test('no emoji in the app chrome', () => {
  for (const f of [...jsFiles, 'index.html', 'css/app.css']) {
    const hit = read(f).match(/\p{Extended_Pictographic}/u);
    assert.equal(hit, null, `${f}: ${hit && hit[0]}`);
  }
});

test('colours come from tokens: no colour values in app code or app layout', () => {
  for (const f of [...jsFiles, 'css/app.css']) {
    const hit = read(f).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    assert.equal(hit, null, `${f}: ${hit && hit[0]}`);
  }
});

test('app layout never redefines a design-system class', () => {
  const own = [...read('css/app.css').matchAll(/^\s*([^{}@/]+)\{/gm)].map(m => m[1].trim());
  const redefined = own.filter(sel => /^\.pc-[\w-]+$/.test(sel));
  assert.deepEqual(redefined, []);
});

test('every class the app uses with the pc- prefix exists in the design system', () => {
  const known = new Set([...read('ds/bundle.css').matchAll(/\.(pc-[\w-]+)/g)].map(m => m[1]));
  const used = new Set();
  for (const f of [...jsFiles, 'index.html']) for (const m of read(f).matchAll(/(?<![\w-])pc-[a-z][\w-]*/g)) used.add(m[0]);
  const unknown = [...used].filter(c => !known.has(c) && c !== 'pc-sheet-' && !c.endsWith('--'));
  assert.deepEqual(unknown, []);
});

test('every icon the app asks for is defined', () => {
  const defined = new Set([...read('js/dom.js').matchAll(/^\s{2}(\w+):'</gm)].map(m => m[1]));
  const asked = new Set();
  for (const f of jsFiles) {
    const src = read(f);
    for (const m of src.matchAll(/\bicon\('(\w+)'/g)) asked.add(m[1]);
    for (const m of src.matchAll(/icon:'(\w+)'/g)) asked.add(m[1]);
    for (const m of src.matchAll(/iconBtn\('\w+','(\w+)'/g)) asked.add(m[1]);
    for (const m of src.matchAll(/badge\('[\w]*','[^']*','(\w+)'/g)) asked.add(m[1]);
  }
  assert.deepEqual([...asked].filter(i => !defined.has(i)), []);
});
