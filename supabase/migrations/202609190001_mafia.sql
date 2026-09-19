-- All mutable game state and roles live outside the exposed API schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.rooms (
 code text primary key check (code ~ '^[A-Z0-9]{6}$'),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table private.games (
 code text primary key references public.rooms(code) on delete cascade,
 host_id uuid not null,
 phase text not null default 'lobby' check(phase in ('lobby','night','discussion','voting','finished')),
 round integer not null default 0,
 deadline timestamptz,
 capacity integer not null check(capacity between 5 and 16),
 duration integer not null check(duration in (30,60,120)),
 winner text,
 log jsonb not null default '["The council is gathering."]',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours'
);
create index games_expiry on private.games(expires_at);
create table private.players (
 room_code text not null references private.games(code) on delete cascade,
 id uuid not null,
 nickname text not null check(char_length(nickname) between 2 and 20),
 alive boolean not null default true,
 ready boolean not null default false,
 role text check(role in ('mafia','doctor','detective','villager')),
 investigation text,
 joined_at timestamptz not null default now(),
 primary key(room_code,id)
);
create index players_identity on private.players(id,room_code);
create unique index players_nickname on private.players(room_code,lower(nickname));
create table private.actions (
 room_code text not null,
 round integer not null,
 phase text not null,
 actor uuid not null,
 target uuid not null,
 primary key(room_code,round,phase,actor),
 foreign key(room_code,actor) references private.players(room_code,id) on delete cascade,
 foreign key(room_code,target) references private.players(room_code,id) on delete cascade
);
alter table public.rooms enable row level security;
alter table private.games enable row level security;
alter table private.players enable row level security;
alter table private.actions enable row level security;
revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;

create function public.is_room_member(p_code text) returns boolean
 language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.players where room_code=p_code and id=auth.uid());
$$;
revoke all on function public.is_room_member(text) from public,anon;
grant execute on function public.is_room_member(text) to authenticated;
create policy room_members_read on public.rooms for select to authenticated using(public.is_room_member(code));

create function private.snapshot(p_code text) returns jsonb
 language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
 'code',g.code,'host_id',g.host_id,'phase',g.phase,'round',g.round,'deadline',g.deadline,
 'capacity',g.capacity,'duration',g.duration,'winner',g.winner,'log',g.log,
 'server_now',clock_timestamp(),'role',me.role,'investigation',me.investigation,
 'submitted',exists(select 1 from private.actions a where a.room_code=g.code and a.round=g.round and a.phase=g.phase and a.actor=auth.uid()),
 'allies',coalesce((select jsonb_agg(p.id) from private.players p where p.room_code=g.code and p.role='mafia' and me.role='mafia'),'[]'),
 'players',(select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'alive',p.alive,'ready',p.ready)||case when g.phase='finished' then jsonb_build_object('role',p.role) else '{}'::jsonb end order by p.joined_at,p.id) from private.players p where p.room_code=g.code)
 ) from private.games g join private.players me on me.room_code=g.code and me.id=auth.uid() where g.code=p_code;
$$;

create function private.resolve_phase(p_code text) returns void
 language plpgsql security definer set search_path = '' as $$
declare g private.games; victim uuid; saved uuid; tally integer; tied integer; n_mafia integer; n_town integer; victim_name text; victim_role text; investigator record;
begin
 select * into g from private.games where code=p_code for update;
 if g.deadline is null or clock_timestamp()<g.deadline or g.phase in ('lobby','finished') then return; end if;
 if g.phase='discussion' then
  update private.games set phase='voting',deadline=clock_timestamp()+make_interval(secs=>g.duration),log=log||jsonb_build_array('The council votes. Choose one suspect.') where code=p_code;
 else
  if g.phase='night' then
   -- A unique plurality of Mafia targets wins. Ties and missing votes cause no kill.
   select a.target,count(*) into victim,tally from private.actions a join private.players p on p.room_code=a.room_code and p.id=a.actor where a.room_code=p_code and a.round=g.round and a.phase='night' and p.role='mafia' group by a.target order by count(*) desc limit 1;
   select count(*) into tied from (select a.target from private.actions a join private.players p on p.room_code=a.room_code and p.id=a.actor where a.room_code=p_code and a.round=g.round and a.phase='night' and p.role='mafia' group by a.target having count(*)=tally) t;
   if tied<>1 then victim=null; end if;
   select a.target into saved from private.actions a join private.players p on p.room_code=a.room_code and p.id=a.actor where a.room_code=p_code and a.round=g.round and a.phase='night' and p.role='doctor';
   for investigator in select a.actor,a.target from private.actions a join private.players p on p.room_code=a.room_code and p.id=a.actor where a.room_code=p_code and a.round=g.round and a.phase='night' and p.role='detective' loop
    update private.players set investigation=(select nickname||' is '||case when role='mafia' then 'Mafia.' else 'not Mafia.' end from private.players where room_code=p_code and id=investigator.target) where room_code=p_code and id=investigator.actor;
   end loop;
   if victim is not null and victim is distinct from saved then
    update private.players set alive=false where room_code=p_code and id=victim returning nickname into victim_name;
    update private.games set log=log||jsonb_build_array(victim_name||' did not survive the night.') where code=p_code;
   else update private.games set log=log||jsonb_build_array('Dawn breaks. Everyone survived the night.') where code=p_code; end if;
   update private.games set phase='discussion',deadline=clock_timestamp()+make_interval(secs=>g.duration) where code=p_code;
  elsif g.phase='voting' then
   select target,count(*) into victim,tally from private.actions where room_code=p_code and round=g.round and phase='voting' group by target order by count(*) desc limit 1;
   select count(*) into tied from (select target from private.actions where room_code=p_code and round=g.round and phase='voting' group by target having count(*)=tally) t;
   if tied=1 and victim is not null then
    update private.players set alive=false where room_code=p_code and id=victim returning nickname,role into victim_name,victim_role;
    update private.games set log=log||jsonb_build_array(victim_name||' was voted out. They were '||victim_role||'.') where code=p_code;
   else update private.games set log=log||jsonb_build_array('No verdict. A tie or an empty vote means nobody is eliminated.') where code=p_code; end if;
   update private.games set phase='night',round=round+1,deadline=clock_timestamp()+make_interval(secs=>g.duration) where code=p_code;
  end if;
  select count(*) filter(where role='mafia'),count(*) filter(where role<>'mafia') into n_mafia,n_town from private.players where room_code=p_code and alive;
  if n_mafia=0 or n_mafia>=n_town then
   update private.games set phase='finished',deadline=null,winner=case when n_mafia=0 then 'town' else 'mafia' end,log=log||jsonb_build_array(case when n_mafia=0 then 'The town wins. All Mafia have been exposed.' else 'The Mafia wins. Blackthorn belongs to the night.' end) where code=p_code;
  end if;
 end if;
 update public.rooms set revision=revision+1,updated_at=clock_timestamp() where code=p_code;
end;
$$;

create function public.game_command(p_action text,p_code text default '',p_payload jsonb default '{}') returns jsonb
 language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); g private.games; me private.players; target_player private.players; n integer; mafia_count integer; nick text; new_code text; shuffled record; pos integer:=0;
begin
 if uid is null then raise exception 'Please sign in anonymously to play.'; end if;
 p_code=upper(trim(p_code));
 if p_action='create' then
  nick=trim(p_payload->>'nickname');
  if nick is null or char_length(nick) not between 2 and 20 then raise exception 'Choose a nickname with 2–20 characters.'; end if;
  if coalesce((p_payload->>'capacity')::int,10) not between 5 and 16 or coalesce((p_payload->>'duration')::int,60) not in (30,60,120) then raise exception 'Invalid room settings.'; end if;
  loop
   new_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
   begin
    insert into public.rooms(code) values(new_code);
    exit;
   exception when unique_violation then null;
   end;
  end loop;
  insert into private.games(code,host_id,capacity,duration) values(new_code,uid,coalesce((p_payload->>'capacity')::int,10),coalesce((p_payload->>'duration')::int,60));
  insert into private.players(room_code,id,nickname) values(new_code,uid,nick);
  return private.snapshot(new_code);
 end if;
 select * into g from private.games where code=p_code for update;
 if not found then raise exception 'Room not found. Check the six-character code.'; end if;
 if g.expires_at<clock_timestamp() then raise exception 'This room is closed. Create a new room.'; end if;
 select * into me from private.players where room_code=p_code and id=uid;
 if p_action='join' and me.id is null then
  if g.phase<>'lobby' then raise exception 'This game has already started. Join the next game.'; end if;
  select count(*) into n from private.players where room_code=p_code;
  if n>=g.capacity then raise exception 'This room is full.'; end if;
  nick=trim(p_payload->>'nickname');
  if nick is null or char_length(nick) not between 2 and 20 then raise exception 'Choose a nickname with 2–20 characters.'; end if;
  if exists(select 1 from private.players where room_code=p_code and lower(nickname)=lower(nick)) then raise exception 'That nickname is taken in this room.'; end if;
  insert into private.players(room_code,id,nickname) values(p_code,uid,nick);
  update public.rooms set revision=revision+1,updated_at=clock_timestamp() where code=p_code;
  return private.snapshot(p_code);
 end if;
 if me.id is null then raise exception 'Enter your nickname to join this room.'; end if;
 if p_action in ('state','join') then perform private.resolve_phase(p_code); return private.snapshot(p_code); end if;
 if p_action='ready' then
  if g.phase<>'lobby' then raise exception 'The game has already started.'; end if;
  update private.players set ready=not ready where room_code=p_code and id=uid;
 elsif p_action='start' then
  if g.host_id<>uid then raise exception 'Only the host can start the game.'; end if;
  if g.phase<>'lobby' then raise exception 'The game has already started.'; end if;
  select count(*) into n from private.players where room_code=p_code;
  if n<5 then raise exception 'At least five players are needed.'; end if;
  if exists(select 1 from private.players where room_code=p_code and not ready) then raise exception 'Everyone must be ready.'; end if;
  mafia_count=case when n>=12 then 3 when n>=7 then 2 else 1 end;
  for shuffled in select id from private.players where room_code=p_code order by random() loop
   pos=pos+1;
   update private.players set role=case when pos<=mafia_count then 'mafia' when pos=mafia_count+1 then 'doctor' when pos=mafia_count+2 then 'detective' else 'villager' end,alive=true,investigation=null where room_code=p_code and id=shuffled.id;
  end loop;
  update private.games set phase='night',round=1,deadline=clock_timestamp()+make_interval(secs=>g.duration),log=log||jsonb_build_array('Night falls. Check your secret identity.') where code=p_code;
 elsif p_action='submit' then
  if g.phase not in ('night','voting') or g.deadline<=clock_timestamp() then raise exception 'The action window is closed. Wait for the next phase.'; end if;
  if not me.alive then raise exception 'Eliminated players cannot act.'; end if;
  select * into target_player from private.players where room_code=p_code and id=(p_payload->>'target')::uuid;
  if target_player.id is null or not target_player.alive then raise exception 'Choose a living player in this room.'; end if;
  if g.phase='night' and me.role='villager' then raise exception 'Villagers have no night action.'; end if;
  if target_player.id=uid and (g.phase='voting' or me.role<>'doctor') then raise exception 'You cannot target yourself.'; end if;
  if g.phase='night' and me.role='mafia' and target_player.role='mafia' then raise exception 'Mafia cannot target a teammate.'; end if;
  if exists(select 1 from private.actions where room_code=p_code and round=g.round and phase=g.phase and actor=uid) then raise exception 'Your choice is already locked in.'; end if;
  insert into private.actions values(p_code,g.round,g.phase,uid,target_player.id);
 elsif p_action='restart' then
  if uid<>g.host_id or g.phase<>'finished' then raise exception 'Only the host can restart a finished game.'; end if;
  delete from private.actions where room_code=p_code;
  update private.players set alive=true,ready=false,role=null,investigation=null where room_code=p_code;
  update private.games set phase='lobby',round=0,winner=null,deadline=null,log='["A fresh council is gathering."]'::jsonb where code=p_code;
 elsif p_action='leave' then
  if g.phase<>'lobby' then raise exception 'You can leave the table only in the lobby. During a game, you can close this page and reconnect later.'; end if;
  delete from private.players where room_code=p_code and id=uid;
  if not exists(select 1 from private.players where room_code=p_code) then delete from public.rooms where code=p_code;
  elsif g.host_id=uid then update private.games set host_id=(select id from private.players where room_code=p_code order by joined_at,id limit 1) where code=p_code; end if;
  update public.rooms set revision=revision+1,updated_at=clock_timestamp() where code=p_code;
  return jsonb_build_object('left',true);
 else raise exception 'Unknown game action.';
 end if;
 -- Submissions do not emit realtime updates: even action timing should stay private.
 if p_action<>'submit' then update public.rooms set revision=revision+1,updated_at=clock_timestamp() where code=p_code; end if;
 return private.snapshot(p_code);
end;
$$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.game_command(text,text,jsonb) from public,anon;
grant execute on function public.game_command(text,text,jsonb) to authenticated;

-- Only the non-sensitive revision signal is published, never roles or actions.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.rooms;
 end if;
end $$;
