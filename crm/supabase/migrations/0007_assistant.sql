-- Apply to a disposable test database first. Does not alter existing CRM data.
create table public.telegram_links (
 owner_id uuid primary key references public.profiles(id),
 chat_id text unique,
 code_hash text unique,
 expires_at timestamptz
);
create table public.telegram_drafts (
 id bigint primary key,
 owner_id uuid not null references public.profiles(id),
 payload text not null,
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 created_at timestamptz not null default now()
);
create table public.team_updates (
 id bigint primary key references public.telegram_drafts(id),
 owner_id uuid not null references public.profiles(id),
 payload text not null,
 created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
alter table public.telegram_drafts enable row level security;
alter table public.team_updates enable row level security;
revoke all on public.telegram_links, public.telegram_drafts, public.team_updates from anon, authenticated;
grant select on public.team_updates to authenticated;
create policy team_updates_read on public.team_updates for select to authenticated
 using(public.is_admin() or (owner_id=auth.uid() and public.is_active_user()));

create function public.telegram_bind(p_hash text,p_chat text) returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
 update telegram_links l set chat_id=p_chat,code_hash=null,expires_at=null
 where code_hash=p_hash and expires_at>now() and exists(select 1 from profiles p where p.id=l.owner_id and p.active);
 get diagnostics affected=row_count;
 return affected=1;
end; $$;

-- One atomic receipt: concurrent/repeated confirmations never append duplicate updates.
create function public.telegram_decide(p_owner uuid,p_id bigint,p_confirm boolean) returns text language plpgsql security definer set search_path=public as $$
declare d telegram_drafts;
begin
 if not exists(select 1 from profiles where id=p_owner and active) then raise exception 'inactive'; end if;
 select * into d from telegram_drafts where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'missing draft'; end if;
 if d.status<>'pending' then return d.status; end if;
 if p_confirm then
  insert into team_updates(id,owner_id,payload) values(d.id,d.owner_id,d.payload);
  insert into telegram_notifications(update_id,recipient)
  select d.id,p.id from profiles p join telegram_links l on l.owner_id=p.id
  where p.role='admin' and p.active and l.chat_id is not null;
 end if;
 update telegram_drafts set status=case when p_confirm then 'confirmed' else 'cancelled' end where id=d.id;
 return case when p_confirm then 'confirmed' else 'cancelled' end;
end; $$;
revoke all on function public.telegram_bind(text,text), public.telegram_decide(uuid,bigint,boolean) from public, anon, authenticated;
grant execute on function public.telegram_bind(text,text), public.telegram_decide(uuid,bigint,boolean) to service_role;

-- Server-only encrypted OAuth refresh credentials, never exposed through RLS.
create table public.google_connections(owner_id uuid primary key references public.profiles(id),payload text not null);
alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon,authenticated;

create table public.training_items (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 topic text not null check(length(topic) between 1 and 200),
 status text not null default 'planned' check(status in ('planned','in_progress','completed')),
 created_at timestamptz not null default now()
);
alter table public.training_items enable row level security;
revoke all on public.training_items from anon,authenticated;
grant select,insert on public.training_items to authenticated;
grant update(status) on public.training_items to authenticated;
create policy training_read on public.training_items for select to authenticated using(public.is_admin() or (owner_id=auth.uid() and public.is_active_user()));
create policy training_add on public.training_items for insert to authenticated with check(public.is_admin());
create policy training_update on public.training_items for update to authenticated using(public.is_admin() or (owner_id=auth.uid() and public.is_active_user())) with check(public.is_admin() or (owner_id=auth.uid() and public.is_active_user()));

create table public.telegram_notifications (
 update_id bigint not null references public.team_updates(id),
 recipient uuid not null references public.profiles(id),
 delivered boolean not null default false,
 primary key(update_id,recipient)
);
alter table public.telegram_notifications enable row level security;
revoke all on public.telegram_notifications from anon,authenticated;
grant all on public.telegram_links,public.telegram_drafts,public.team_updates,public.google_connections,public.training_items,public.telegram_notifications to service_role;
