import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url));

test('PadelChamp.html is byte-identical to index.html', () => {
  assert.ok(read('index.html').equals(read('PadelChamp.html')));
});

test('backups are ignored by git', () => {
  assert.match(read('.gitignore').toString(), /^backups\/$/m);
});
