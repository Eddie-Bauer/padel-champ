// There is no bundler or linter to notice a missing import, and a modal that
// no test opens would only fail in the browser. This check finds any use of
// another module's export that the file does not import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../js/', import.meta.url);
const files = [...readdirSync(dir).filter(f => f.endsWith('.js')), ...readdirSync(new URL('views/', dir)).map(f => 'views/' + f)];
const src = Object.fromEntries(files.map(f => [f, readFileSync(new URL(f, dir), 'utf8')]));

const exportsOf = code => [
  ...[...code.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map(m => m[1]),
  ...[...code.matchAll(/^export let ([^;]+);/gm)].flatMap(m => m[1].split(',').map(s => s.trim().split('=')[0])),
];
const importsOf = code => [...code.matchAll(/^import \{([^}]*)\} from/gm)].flatMap(m => m[1].split(',').map(s => s.trim()));
// Code only: no import lines, comments or string contents.
const strip = code => code
  .replace(/^import .*$/gm, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''");

const allExports = Object.fromEntries(files.map(f => [f, exportsOf(src[f])]));

for (const f of files) {
  test(`${f} imports everything it uses from other modules`, () => {
    const code = strip(src[f]);
    const have = new Set([...importsOf(src[f]), ...allExports[f]]);
    const missing = [];
    for (const [other, names] of Object.entries(allExports)) {
      if (other === f || other === 'main.js') continue;
      for (const n of names) {
        if (have.has(n)) continue;
        if (new RegExp('(?<![\\w$.])' + n + '(?![\\w$:])').test(code)) missing.push(`${n} (from ${other})`);
      }
    }
    assert.deepEqual(missing, []);
  });
}
