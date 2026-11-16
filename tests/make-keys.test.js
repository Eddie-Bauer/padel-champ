import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKeys, hashOf } from '../scripts/make-keys.mjs';
import { sha256Hex } from '../supabase/functions/api/index.ts';

test('makeKeys gives one distinct key per role with its secret name', () => {
  const keys = makeKeys();
  assert.deepEqual(keys.map(k => k.role), ['viewer', 'player', 'admin']);
  assert.deepEqual(keys.map(k => k.secret), ['PC_VIEWER_HASH', 'PC_PLAYER_HASH', 'PC_ADMIN_HASH']);
  assert.equal(new Set(keys.map(k => k.key)).size, 3);
  for (const k of keys) {
    assert.ok(k.key.length >= 20);
    assert.match(k.key, /^[A-Za-z0-9_-]+$/, 'must survive in a URL unescaped');
  }
});

test('the hash is the one the api function computes for the same key', async () => {
  const [k] = makeKeys(() => 'fixed-test-key');
  assert.equal(k.hash, hashOf('fixed-test-key'));
  assert.equal(k.hash, await sha256Hex('fixed-test-key'));
});
