-- Palate: invite-only access. Run after schema.sql. Safe to re-run.
--
-- Only emails in allowed_emails can create an account or read/write data.
-- Anyone else can file an access request, which an admin approves or denies
-- from the app (Backup & data menu → Access requests).

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  is_admin boolean not null default false,
  added_at timestamptz not null default now()
);

create table if not exists public.access_requests (
  email text primary key check (email = lower(email)),
  name text not null default '' check (char_length(name) <= 100),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.allowed_emails enable row level security;
alter table public.access_requests enable row level security;
-- No policies: these tables are only reached through the functions below.

insert into public.allowed_emails (email, is_admin)
values ('9shrey@gmail.com', true)
on conflict (email) do update set is_admin = true;

-- Is the signed-in user's email on the allowlist?
create or replace function public.is_allowed()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and is_admin
  );
$$;

-- What the sign-in screen should show for an email: allowed | pending | denied | none.
create or replace function public.access_status(p_email text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.allowed_emails where email = lower(trim(p_email))) then 'allowed'
    else coalesce((select status from public.access_requests where email = lower(trim(p_email))), 'none')
  end;
$$;

-- File (or refresh) a request. Returns the resulting status.
create or replace function public.request_access(p_email text, p_name text, p_note text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
  s text := public.access_status(e);
begin
  if e !~ '^\S+@\S+\.\S+$' or char_length(e) > 254 then
    raise exception 'invalid email';
  end if;
  if s in ('allowed', 'denied') then
    return s;
  end if;
  insert into public.access_requests (email, name, note)
  values (e, left(trim(coalesce(p_name, '')), 100), left(trim(coalesce(p_note, '')), 500))
  on conflict (email) do update
    set name = excluded.name, note = excluded.note;
  return 'pending';
end;
$$;

-- Admin: list requests, newest first.
create or replace function public.list_access_requests()
returns setof public.access_requests
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return query select * from public.access_requests order by (status = 'pending') desc, created_at desc;
end;
$$;

-- Admin: approve or deny a request.
create or replace function public.decide_access(p_email text, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.access_requests
    set status = case when p_approve then 'approved' else 'denied' end, decided_at = now()
    where email = e;
  if p_approve then
    insert into public.allowed_emails (email) values (e) on conflict do nothing;
  else
    delete from public.allowed_emails where email = e and not is_admin;
  end if;
end;
$$;

revoke all on function public.is_allowed(), public.is_admin(), public.access_status(text),
  public.request_access(text, text, text), public.list_access_requests(), public.decide_access(text, boolean)
  from public, anon, authenticated;
grant execute on function public.access_status(text), public.request_access(text, text, text) to anon, authenticated;
grant execute on function public.is_allowed(), public.is_admin(), public.list_access_requests(),
  public.decide_access(text, boolean) to authenticated;

-- Block account creation for emails that are not on the allowlist.
create or replace function public.enforce_allowlist()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(coalesce(new.email, ''))) then
    raise exception 'Palate is invite-only. Request access first.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_allowlist() from public, anon, authenticated;

drop trigger if exists enforce_allowlist on auth.users;
create trigger enforce_allowlist
  before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- Data access also requires an allowed email, so removing someone cuts them off.
drop policy if exists "own foods" on public.foods;
create policy "own foods" on public.foods
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_allowed()))
  with check ((select auth.uid()) = user_id and (select public.is_allowed()));

drop policy if exists "own occasions" on public.occasions;
create policy "own occasions" on public.occasions
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_allowed()))
  with check ((select auth.uid()) = user_id and (select public.is_allowed()));

drop policy if exists "own photos read" on storage.objects;
create policy "own photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_allowed()));

drop policy if exists "own photos insert" on storage.objects;
create policy "own photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_allowed()));

drop policy if exists "own photos update" on storage.objects;
create policy "own photos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_allowed()));

drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_allowed()));
