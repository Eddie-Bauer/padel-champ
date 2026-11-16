// @ts-nocheck  (plain JavaScript on purpose, see the note on imports below)
// PadelChamp "api" Edge Function. The only door to the database.
//
// Every request carries the access key in the header "x-pc-key". The key
// decides the role (viewer, player, admin); the role decides what is allowed.
//
// Required secrets (Dashboard → Edge Functions → Secrets):
//   PC_VIEWER_HASH, PC_PLAYER_HASH, PC_ADMIN_HASH   SHA-256 of each key, hex
//   GOOGLE_AI_KEY                                    for the AI analysis
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// "Verify JWT" must be switched OFF for this function: the key check below
// replaces it.
//
// The file has no imports on purpose, so it can be pasted into the dashboard
// editor as it is, and tested under Node (see tests/api.test.js).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-pc-key, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_MAX_PER_DAY = 40;
const MAX_OPS = 5000;
const MAX_PROMPT = 20000;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── Roles ───────────────────────────────────────────────────────────────────
const RANK = { viewer: 1, player: 2, admin: 3 };

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Compares without stopping at the first difference.
const sameHex = (a, b) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function roleFor(key, env) {
  if (typeof key !== "string" || key.length === 0 || key.length > 200) return null;
  const hash = await sha256Hex(key);
  for (const role of ["admin", "player", "viewer"]) {
    const want = (env.get("PC_" + role.toUpperCase() + "_HASH") || "").trim().toLowerCase();
    // A secret that is missing or not a SHA-256 value can never match.
    if (/^[0-9a-f]{64}$/.test(want) && sameHex(hash, want)) return role;
  }
  return null;
}

// ── What a change may look like, and who may make it ────────────────────────
const COLUMNS = {
  players: ["id", "name", "is_active"],
  seasons: ["id", "name", "start_date", "end_date", "is_active"],
  events: ["id", "season_id", "date", "name", "status"],
  event_players: ["event_id", "player_id"],
  teams: ["id", "event_id", "rnd", "player1_id", "player2_id", "name"],
  matches: ["id", "event_id", "team1_id", "team2_id", "rnd", "seq",
    "t1s1", "t2s1", "t1s2", "t2s2", "t1s3", "t2s3", "winner_team_id", "status"],
  bye_map: ["event_id", "rnd", "player_id"],
  settings: ["id", "pts_win", "pts_loss"],
};

const KEYS = {
  players: ["id"], seasons: ["id"], events: ["id"], teams: ["id"], matches: ["id"], settings: ["id"],
  event_players: ["event_id", "player_id"],
  bye_map: ["event_id", "rnd"],
};

// Lowest role allowed per table and action. No entry: not allowed at all.
const RULES = {
  players: { upsert: "admin", delete: "admin" },
  seasons: { upsert: "admin", delete: "admin" },
  settings: { upsert: "admin" },
  events: { upsert: "player", delete: "admin" },
  event_players: { upsert: "player", delete: "player" },
  teams: { upsert: "player", delete: "player" },
  matches: { upsert: "player", delete: "player" },
  bye_map: { upsert: "player", delete: "player" },
};

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isScalar = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
const isKeyValue = (v) => (typeof v === "string" && v.length > 0) || typeof v === "number";

// Checks the whole list before anything is applied: one bad change refuses
// the batch. Shape problems are 400, missing rights are 403.
export function checkOps(role, ops) {
  const bad = (msg) => ({ ok: false, status: 400, error: msg });
  if (!Array.isArray(ops)) return bad("ops must be a list");
  if (ops.length > MAX_OPS) return bad("too many changes in one request");
  for (const o of ops) {
    if (!isObj(o)) return bad("change must be an object");
    const rule = Object.hasOwn(RULES, o.t) ? RULES[o.t] : null;
    if (!rule) return bad("unknown table");
    if (!Object.hasOwn(rule, o.a)) return bad("action not available for " + o.t);
    if (o.a === "upsert") {
      if (!isObj(o.row)) return bad("upsert without row");
      for (const [col, val] of Object.entries(o.row)) {
        if (!COLUMNS[o.t].includes(col)) return bad("unknown column in " + o.t);
        if (!isScalar(val)) return bad("invalid value in " + o.t);
      }
      for (const k of KEYS[o.t]) if (!isKeyValue(o.row[k])) return bad("row without key in " + o.t);
    } else {
      if (!isObj(o.key)) return bad("delete without key");
      const given = Object.keys(o.key);
      if (given.length !== KEYS[o.t].length) return bad("wrong key for " + o.t);
      for (const k of KEYS[o.t]) if (!isKeyValue(o.key[k])) return bad("wrong key for " + o.t);
    }
  }
  for (const o of ops) {
    if (RANK[role] < RANK[RULES[o.t][o.a]]) return { ok: false, status: 403, error: "not allowed for this key" };
  }
  return { ok: true };
}

// ── Database access with the service key ────────────────────────────────────
export function makeDb(env, fetchFn = fetch) {
  const url = env.get("SUPABASE_URL");
  const key = env.get("SUPABASE_SERVICE_ROLE_KEY");
  return {
    async rpc(name, args) {
      const res = await fetchFn(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.message) || "database error " + res.status);
      return data;
    },
  };
}

// ── AI analysis (Google Gemini) ─────────────────────────────────────────────
async function analyze(prompt, env, fetchFn) {
  const googleKey = env.get("GOOGLE_AI_KEY");
  if (!googleKey) throw new Error("GOOGLE_AI_KEY is not set");
  // b64: gemini-flash-latest endpoint (avoids URL auto-linking in the Supabase editor)
  const b64 = "aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy9nZW1pbmktZmxhc2gtbGF0ZXN0OmdlbmVyYXRlQ29udGVudD9rZXk9";
  const res = await fetchFn(atob(b64) + googleKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  return await res.json();
}

// ── Request handling ────────────────────────────────────────────────────────
export async function handle(req, { env, db, fetchFn = fetch }) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const role = await roleFor(req.headers.get("x-pc-key"), env);
  if (!role) return json(401, { error: "unauthorized" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "body must be JSON" });
  }
  if (!isObj(body)) return json(400, { error: "body must be an object" });

  try {
    if (body.action === "state") {
      return json(200, { role, state: await db.rpc("get_state", {}) });
    }

    if (body.action === "ops") {
      if (RANK[role] < RANK.player) return json(403, { error: "not allowed for this key" });
      const check = checkOps(role, body.ops);
      if (!check.ok) return json(check.status, { error: check.error });
      return json(200, { applied: await db.rpc("apply_ops", { ops: body.ops }) });
    }

    if (body.action === "analyze") {
      if (RANK[role] < RANK.player) return json(403, { error: "not allowed for this key" });
      if (typeof body.prompt !== "string" || body.prompt.length === 0 || body.prompt.length > MAX_PROMPT) {
        return json(400, { error: "invalid prompt" });
      }
      const allowed = await db.rpc("bump_ai_usage", { max_per_day: AI_MAX_PER_DAY });
      if (!allowed) return json(429, { error: "Tageslimit für die KI-Analyse erreicht. Morgen wieder." });
      return json(200, await analyze(body.prompt, env, fetchFn));
    }

    return json(400, { error: "unknown action" });
  } catch (e) {
    console.error("api error:", e);
    return json(500, { error: "server error", detail: String(e && e.message || e) });
  }
}

// Started by Supabase (Deno). Under Node (tests) this block does nothing.
if (typeof Deno !== "undefined") {
  const env = { get: (k) => Deno.env.get(k) };
  const db = makeDb(env);
  Deno.serve((req) => handle(req, { env, db }));
}
