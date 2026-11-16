-- PadelChamp: the minimum number of matches for the season ranking becomes a setting.
-- Paste the whole file into the Supabase SQL editor and run it.
-- Safe to run more than once. Needs 03_tournaments.sql to have run before.

alter table public.settings add column if not exists min_matches integer not null default 10;

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
          insert into public.events (id, season_id, date, name, status, format, config)
          select id, season_id, date, name, status, coalesce(format, 'padel_day'), coalesce(config, '{}'::jsonb)
          from jsonb_populate_record(null::public.events, r)
          on conflict (id) do update set season_id = excluded.season_id, date = excluded.date,
            name = excluded.name, status = excluded.status,
            -- An app version from before tournaments does not send these: keep what is stored.
            format = case when r ? 'format' then excluded.format else public.events.format end,
            config = case when r ? 'config' then excluded.config else public.events.config end;
        when 'teams' then
          insert into public.teams (id, event_id, rnd, player1_id, player2_id, name, grp)
          select id, event_id, rnd, player1_id, player2_id, name, grp from jsonb_populate_record(null::public.teams, r)
          on conflict (id) do update set event_id = excluded.event_id, rnd = excluded.rnd,
            player1_id = excluded.player1_id, player2_id = excluded.player2_id, name = excluded.name,
            grp = case when r ? 'grp' then excluded.grp else public.teams.grp end;
        when 'matches' then
          insert into public.matches (id, event_id, team1_id, team2_id, rnd, seq,
            t1s1, t2s1, t1s2, t2s2, t1s3, t2s3, winner_team_id, status, stage, court)
          select id, event_id, team1_id, team2_id, rnd, seq,
            t1s1, t2s1, t1s2, t2s2, t1s3, t2s3, winner_team_id, status, stage, court
          from jsonb_populate_record(null::public.matches, r)
          on conflict (id) do update set event_id = excluded.event_id, team1_id = excluded.team1_id,
            team2_id = excluded.team2_id, rnd = excluded.rnd, seq = excluded.seq,
            t1s1 = excluded.t1s1, t2s1 = excluded.t2s1, t1s2 = excluded.t1s2, t2s2 = excluded.t2s2,
            t1s3 = excluded.t1s3, t2s3 = excluded.t2s3,
            winner_team_id = excluded.winner_team_id, status = excluded.status,
            stage = case when r ? 'stage' then excluded.stage else public.matches.stage end,
            court = case when r ? 'court' then excluded.court else public.matches.court end;
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
          -- Only what the row contains is changed; the rest stays as stored.
          update public.settings
          set pts_win     = case when r ? 'pts_win'     then (r->>'pts_win')::integer     else pts_win end,
              pts_loss    = case when r ? 'pts_loss'    then (r->>'pts_loss')::integer    else pts_loss end,
              min_matches = case when r ? 'min_matches' then (r->>'min_matches')::integer else min_matches end
          where id = 1;
          if not found then
            insert into public.settings (id, pts_win, pts_loss, min_matches)
            values (1, coalesce((r->>'pts_win')::integer, 3), coalesce((r->>'pts_loss')::integer, 0),
                    coalesce((r->>'min_matches')::integer, 10));
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

-- Only the Edge Function (service key) may call it.
revoke execute on function public.apply_ops(jsonb) from public, anon, authenticated;
grant execute on function public.apply_ops(jsonb) to service_role;
