-- Run once on an existing MooMate database before the MVP demo.
drop policy if exists "public read rooms" on rooms;
drop policy if exists "public read participants" on participants;
drop policy if exists "public read matches" on matches;
drop policy if exists "public read games" on games;
create unique index if not exists games_match_id_unique on games(match_id);
