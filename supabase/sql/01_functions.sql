-- PadelChamp, rollout step 1: database functions used by the "api" Edge Function.
-- Paste the whole file into the Supabase SQL editor and run it.
-- Safe to run more than once. It does not change or lock any existing data.

-- ── Read everything in one call ─────────────────────────────────────────────
create or replace function public.get_state()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'players',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.players x),
    'seasons',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.seasons x),
    'events',        (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.events x),
    'event_players', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.event_players x),
    'teams',         (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.teams x),
    'matches',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.matches x),
    'bye_map',       (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.bye_map x),
    'settings',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.settings x)
  );
$$;

-- ── Apply a list of changes, all or nothing ─────────────────────────────────
-- ops: [{"t": table, "a": "upsert", "row": {...}} | {"t": table, "a": "delete", "key": {...}}]
-- A function call is one transaction: if any change fails, none is stored.
create or replace function public.apply_ops(ops jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  o jsonb;
  t text;
  a text;
  r jsonb;
  k jsonb;
  n integer := 0;
begin
  if ops is null or jsonb_typeof(ops) <> 'array' then
    raise exception 'ops must be a list';
  end if;

  for o in select value from jsonb_array_elements(ops) loop
    t := o->>'t';
    a := o->>'a';
    r := o->'row';
    k := o->'key';

    if a = 'upsert' then
      if r is null or jsonb_typeof(r) <> 'object' then
        raise exception 'upsert on % without row', t;
      end if;
      case t
        when 'players' then
          insert into public.players (id, name, is_active)
          select id, name, is_active from jsonb_populate_record(null::public.players, r)
          on conflict (id) do update set name = excluded.name, is_active = excluded.is_active;
        when 'seasons' then
          insert into public.seasons (id, name, start_date, end_date, is_active)
          select id, name, start_date, end_date, is_active from jsonb_populate_record(null::public.seasons, r)
          on conflict (id) do update set name = excluded.name, start_date = excluded.start_date,
            end_date = excluded.end_date, is_active = excluded.is_active;
        when 'events' then
          insert into public.events (id, season_id, date, name, status)
          select id, season_id, date, name, status from jsonb_populate_record(null::public.events, r)
          on conflict (id) do update set season_id = excluded.season_id, date = excluded.date,
            name = excluded.name, status = excluded.status;
        when 'teams' then
          insert into public.teams (id, event_id, rnd, player1_id, player2_id, name)
          select id, event_id, rnd, player1_id, player2_id, name from jsonb_populate_record(null::public.teams, r)
          on conflict (id) do update set event_id = excluded.event_id, rnd = excluded.rnd,
            player1_id = excluded.player1_id, player2_id = excluded.player2_id, name = excluded.name;
        when 'matches' then
          insert into public.matches (id, event_id, team1_id, team2_id, rnd, seq,
            t1s1, t2s1, t1s2, t2s2, t1s3, t2s3, winner_team_id, status)
          select id, event_id, team1_id, team2_id, rnd, seq,
            t1s1, t2s1, t1s2, t2s2, t1s3, t2s3, winner_team_id, status
          from jsonb_populate_record(null::public.matches, r)
          on conflict (id) do update set event_id = excluded.event_id, team1_id = excluded.team1_id,
            team2_id = excluded.team2_id, rnd = excluded.rnd, seq = excluded.seq,
            t1s1 = excluded.t1s1, t2s1 = excluded.t2s1, t1s2 = excluded.t1s2, t2s2 = excluded.t2s2,
            t1s3 = excluded.t1s3, t2s3 = excluded.t2s3,
            winner_team_id = excluded.winner_team_id, status = excluded.status;
        when 'event_players' then
          delete from public.event_players
          where event_id::text = r->>'event_id' and player_id::text = r->>'player_id';
          insert into public.event_players (event_id, player_id)
          select event_id, player_id from jsonb_populate_record(null::public.event_players, r);
        when 'bye_map' then
          delete from public.bye_map
          where event_id::text = r->>'event_id' and rnd = (r->>'rnd')::integer;
          insert into public.bye_map (event_id, rnd, player_id)
          select event_id, rnd, player_id from jsonb_populate_record(null::public.bye_map, r);
        when 'settings' then
          update public.settings
          set pts_win = (r->>'pts_win')::integer, pts_loss = (r->>'pts_loss')::integer
          where id = 1;
          if not found then
            insert into public.settings (id, pts_win, pts_loss)
            values (1, (r->>'pts_win')::integer, (r->>'pts_loss')::integer);
          end if;
        else
          raise exception 'unknown table %', t;
      end case;

    elsif a = 'delete' then
      if k is null or jsonb_typeof(k) <> 'object' then
        raise exception 'delete on % without key', t;
      end if;
      case t
        when 'players' then delete from public.players where id::text = k->>'id';
        when 'seasons' then delete from public.seasons where id::text = k->>'id';
        when 'events'  then delete from public.events  where id::text = k->>'id';
        when 'teams'   then delete from public.teams   where id::text = k->>'id';
        when 'matches' then delete from public.matches where id::text = k->>'id';
        when 'event_players' then
          delete from public.event_players
          where event_id::text = k->>'event_id' and player_id::text = k->>'player_id';
        when 'bye_map' then
          delete from public.bye_map
          where event_id::text = k->>'event_id' and rnd = (k->>'rnd')::integer;
        else
          raise exception 'unknown table %', t;
      end case;

    else
      raise exception 'unknown action %', a;
    end if;

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ── Daily counter for the AI analysis ───────────────────────────────────────
create table if not exists public.ai_usage (
  day date primary key,
  n integer not null default 0
);
alter table public.ai_usage enable row level security;

-- Counts one request for today. Returns false once the daily limit is passed.
create or replace function public.bump_ai_usage(max_per_day integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  c integer;
begin
  insert into public.ai_usage (day, n) values (current_date, 1)
  on conflict (day) do update set n = public.ai_usage.n + 1
  returning n into c;
  return c <= max_per_day;
end;
$$;

-- ── Only the Edge Function (service key) may call these ─────────────────────
revoke execute on function public.get_state() from public, anon, authenticated;
revoke execute on function public.apply_ops(jsonb) from public, anon, authenticated;
revoke execute on function public.bump_ai_usage(integer) from public, anon, authenticated;
grant execute on function public.get_state() to service_role;
grant execute on function public.apply_ops(jsonb) to service_role;
grant execute on function public.bump_ai_usage(integer) to service_role;
