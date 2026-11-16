-- PadelChamp, rollout LAST step: close the database to the public key.
-- Run this only after the new app version is live and works with the new keys.
-- From then on, reading and writing is only possible through the "api" function.
-- Safe to run more than once.

-- Remove every existing access rule on the app's tables.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('players', 'seasons', 'events', 'event_players',
                        'teams', 'matches', 'bye_map', 'settings', 'ai_usage')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- Row-level security on, with no rule: the public key sees and changes nothing.
alter table public.players       enable row level security;
alter table public.seasons       enable row level security;
alter table public.events        enable row level security;
alter table public.event_players enable row level security;
alter table public.teams         enable row level security;
alter table public.matches       enable row level security;
alter table public.bye_map       enable row level security;
alter table public.settings      enable row level security;
alter table public.ai_usage      enable row level security;

-- To undo (reopens the database to everyone, only for an emergency):
--   alter table public.players disable row level security;   -- and so on per table
