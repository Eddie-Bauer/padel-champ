// Creates three new access keys and their SHA-256 values.
// Run it in your own terminal. Nothing is stored or sent anywhere:
//
//   node scripts/make-keys.mjs
//
// The KEYS go into the links you hand out. The HASHES go into the Supabase
// function secrets. Keep the keys somewhere safe; they cannot be recovered
// from the hashes.
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROLES = ['viewer', 'player', 'admin'];

export const hashOf = key => createHash('sha256').update(key).digest('hex');

export const makeKeys = (random = () => randomBytes(18).toString('base64url')) =>
  ROLES.map(role => { const key = random(); return { role, key, secret: 'PC_' + role.toUpperCase() + '_HASH', hash: hashOf(key) }; });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] || 'https://<deine-app-adresse>/';
  const keys = makeKeys();
  console.log('\n1) Links (aufbewahren und weitergeben):\n');
  for (const k of keys) console.log(`   ${k.role.padEnd(7)} ${base}?key=${k.key}`);
  console.log('\n2) Supabase → Edge Functions → Secrets (Name = Wert):\n');
  for (const k of keys) console.log(`   ${k.secret} = ${k.hash}`);
  console.log('');
}
