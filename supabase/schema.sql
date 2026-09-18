-- Loop — full database schema.
-- Paste into the Supabase SQL editor and run once.

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Student',
  handle text unique not null,
  emoji text not null default '🦊',
  status text default '',
  points int not null default 0,
  streak int not null default 0,
  last_done date,
  push_token text,
  created_at timestamptz default now()
);

create function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    coalesce(new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text, 1, 8))
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade,
  title text not null,
  subject text default 'Life',
  due date not null default current_date,
  priority int not null default 1,
  done boolean not null default false,
  created_at timestamptz default now()
);
create index on public.tasks (owner, due);

create table public.task_shares (
  task_id uuid references public.tasks on delete cascade,
  friend_id uuid references public.profiles on delete cascade,
  primary key (task_id, friend_id)
);

-- ---------- timetable ----------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  starts_at text not null,          -- '08:40'
  name text not null,
  room text default ''
);
create index on public.lessons (owner, weekday);

-- ---------- friendships ----------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Accepting creates the reciprocal row, so friendship is always mutual.
create function public.accept_friend(request_id uuid) returns void language plpgsql security definer as $$
declare r public.friendships;
begin
  select * into r from public.friendships where id = request_id and friend_id = auth.uid();
  if r is null then raise exception 'not your request'; end if;
  update public.friendships set accepted = true where id = request_id;
  insert into public.friendships (user_id, friend_id, accepted)
  values (r.friend_id, r.user_id, true)
  on conflict (user_id, friend_id) do update set accepted = true;
end $$;

-- ---------- activity feed ----------
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references public.profiles on delete cascade,
  text text not null,
  kind text default 'note',
  created_at timestamptz default now()
);
create index on public.activity (created_at desc);

-- You see your own activity and your accepted friends'.
create view public.feed_visible
with (security_invoker = true) as
select a.id, a.text, a.kind, a.created_at, p.name as who, p.emoji
from public.activity a
join public.profiles p on p.id = a.actor
where a.actor = auth.uid()
   or exists (
     select 1 from public.friendships f
     where f.user_id = auth.uid() and f.friend_id = a.actor and f.accepted
   )
order by a.created_at desc;

-- ---------- study rooms ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles on delete cascade,
  name text not null,
  at timestamptz not null,
  created_at timestamptz default now()
);
create table public.room_members (
  room_id uuid references public.rooms on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (room_id, user_id)
);

-- ---------- push queue ----------
-- Filled by the app (a nudge, a due-date reminder) and drained by the
-- send-push edge function in supabase/functions/send-push.
create table public.push_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null,
  body text not null,
  data jsonb,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index on public.push_queue (send_after) where sent_at is null;

-- A nudge becomes a real notification on their phone.
-- Parameters are prefixed with p_ so they can never collide with a
-- column name inside the function body (friend_id is also a column
-- on friendships and push_queue).
create function public.nudge(p_friend_id uuid, p_from_name text) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from public.friendships f
                 where f.user_id = auth.uid() and f.friend_id = p_friend_id and f.accepted)
  then raise exception 'not your friend'; end if;
  insert into public.push_queue (user_id, title, body, data)
  values (p_friend_id, p_from_name || ' nudged you', 'Someone thinks you should get started.',
          jsonb_build_object('kind', 'nudge'));
end $$;

-- ---------- row level security ----------
alter table public.profiles     enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_shares  enable row level security;
alter table public.lessons      enable row level security;
alter table public.friendships  enable row level security;
alter table public.activity     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.push_queue   enable row level security;

create function public.is_friend(other uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.friendships
                 where user_id = auth.uid() and friend_id = other and accepted)
$$;

-- profiles: anyone signed in can look up a handle to send a request; you edit only yourself
create policy "read profiles"  on public.profiles for select to authenticated using (true);
create policy "edit own"       on public.profiles for update to authenticated using (id = auth.uid());

-- tasks: yours, or ones shared with you (read only)
create policy "own tasks"      on public.tasks for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "shared tasks"   on public.tasks for select to authenticated
  using (exists (select 1 from public.task_shares s where s.task_id = id and s.friend_id = auth.uid()));

create policy "manage shares"  on public.task_shares for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and t.owner = auth.uid())
         or friend_id = auth.uid())
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.owner = auth.uid()));

create policy "own lessons"    on public.lessons for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

create policy "see friendships" on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy "send requests"   on public.friendships for insert to authenticated
  with check (user_id = auth.uid());
create policy "drop friendship" on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "post activity"   on public.activity for insert to authenticated with check (actor = auth.uid());
create policy "read activity"   on public.activity for select to authenticated
  using (actor = auth.uid() or public.is_friend(actor));

create policy "own queue"       on public.push_queue for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read rooms"      on public.rooms for select to authenticated
  using (host = auth.uid() or public.is_friend(host));
create policy "host rooms"      on public.rooms for all to authenticated
  using (host = auth.uid()) with check (host = auth.uid());
create policy "room members"    on public.room_members for all to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.rooms r where r.id = room_id and r.host = auth.uid()))
  with check (user_id = auth.uid());

-- ---------- realtime ----------
alter publication supabase_realtime add table public.tasks, public.activity, public.rooms, public.friendships;
