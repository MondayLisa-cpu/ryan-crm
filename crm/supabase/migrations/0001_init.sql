-- =====================================================================
-- 保險團隊跟客系統 — 第一版資料庫
-- 喺 Supabase → SQL Editor 貼晒成個檔案執行一次即可。
--
-- 私隱設計（香港《個人資料（私隱）條例》）：
--   * 客戶姓名、職業、所有表格內容喺 Next.js 伺服器用 AES-256-GCM 加密後先存入，
--     資料庫入面只見到密文（info / form_* 欄位）。
--   * Row Level Security：員工只可睇／改自己嘅客；管理員只可「睇」全部。
--   * 審計記錄：資料庫 trigger 自動記低邊個、幾時、改咗邊啲欄位，冇人可以改或刪。
-- =====================================================================

-- ---------- 類型 ----------
create type public.app_role as enum ('admin', 'agent');
create type public.client_stage as enum ('RR', 'NR1', 'NR2', 'FNA', 'PC', 'SIGNED', 'ISSUED');

-- ---------- 員工資料 ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        public.app_role not null default 'agent',
  active      boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 新 Auth 用戶自動建立 profile。角色一定係 agent；
-- created_by 只可以由伺服器（service role）經 app_metadata 設定，用戶自己改唔到。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, created_by)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_app_meta_data ->> 'full_name', ''),
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supabase 開帳戶時可能先 insert 再寫 app_metadata，所以 update 時都補返姓名／建立者
create or replace function public.handle_user_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
     set full_name  = case when p.full_name = '' then coalesce(new.raw_app_meta_data ->> 'full_name', '') else p.full_name end,
         created_by = coalesce(p.created_by, nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid)
   where p.id = new.id
     and (p.full_name = '' or p.created_by is null)
     and (coalesce(new.raw_app_meta_data ->> 'full_name', '') <> '' or new.raw_app_meta_data ? 'created_by');
  return new;
end;
$$;

create trigger on_auth_user_meta
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_meta();

-- ---------- 權限輔助函數 ----------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and active and role = 'admin'
  );
$$;

-- ---------- 準客戶 ----------
-- info / form_* 係 jsonb：每個 key 係一個欄位，value 係「v1.」開頭嘅密文。
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references public.profiles (id),
  stage                 public.client_stage not null default 'RR',
  info                  jsonb not null default '{}'::jsonb,
  form_rr               jsonb not null default '{}'::jsonb,
  form_nr1              jsonb not null default '{}'::jsonb,
  form_nr2              jsonb not null default '{}'::jsonb,
  form_fna              jsonb not null default '{}'::jsonb,
  form_pc               jsonb not null default '{}'::jsonb,
  -- RR 四個條件
  rr_like_trust         boolean not null default false,
  rr_stable_income      boolean not null default false,
  rr_relationship       boolean not null default false,
  rr_understand_goal    boolean not null default false,
  -- NR2 完結前四個條件
  nr2_need_confirmed    boolean not null default false,
  nr2_plan_previewed    boolean not null default false,
  nr2_budget_set        boolean not null default false,
  nr2_next_meeting      boolean not null default false,
  ready_to_sign         boolean generated always as (
    rr_like_trust and rr_stable_income and rr_relationship and rr_understand_goal and
    nr2_need_confirmed and nr2_plan_previewed and nr2_budget_set and nr2_next_meeting
  ) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid
);

create index clients_owner_idx on public.clients (owner_id);

create or replace function public.touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'clients' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated();

-- 管理員唔可以停用自己或者將自己降級（避免冇人管）
create or replace function public.protect_self_profile()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid() and (new.active is distinct from old.active or new.role is distinct from old.role) then
    raise exception '唔可以更改自己嘅角色或狀態';
  end if;
  if new.email is distinct from old.email or new.id is distinct from old.id then
    raise exception '唔可以直接更改電郵';
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_self_profile();

-- ---------- 審計記錄 ----------
create table public.audit_log (
  id               bigint generated always as identity primary key,
  at               timestamptz not null default now(),
  actor_id         uuid,
  action           text not null,          -- INSERT / UPDATE / DELETE
  table_name       text not null,
  record_id        uuid not null,
  client_owner_id  uuid,                    -- 方便員工睇自己客嘅記錄
  changes          jsonb not null default '{}'::jsonb
);

create index audit_log_record_idx on public.audit_log (record_id, at desc);
create index audit_log_owner_idx on public.audit_log (client_owner_id, at desc);

-- 比較新舊 row：普通欄位記低前後值；加密欄位（jsonb）只記低「邊個 key 改咗」，唔會抄密文。
create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else '{}'::jsonb end;
  diff jsonb := '{}'::jsonb;
  col text;
  k text;
  rec_id uuid;
  owner uuid;
  actor uuid;
  enc_cols text[] := array['info', 'form_rr', 'form_nr1', 'form_nr2', 'form_fna', 'form_pc'];
  skip_cols text[] := array['updated_at', 'updated_by', 'created_at', 'ready_to_sign'];
begin
  for col in select jsonb_object_keys(o || n) loop
    continue when col = any (skip_cols);
    if col = any (enc_cols) then
      for k in
        select distinct key from (
          select jsonb_object_keys(coalesce(o -> col, '{}'::jsonb)) as key
          union
          select jsonb_object_keys(coalesce(n -> col, '{}'::jsonb))
        ) s
      loop
        if (o -> col -> k) is distinct from (n -> col -> k) then
          diff := diff || jsonb_build_object(col || '.' || k, 'changed');
        end if;
      end loop;
    elsif (o -> col) is distinct from (n -> col) then
      diff := diff || jsonb_build_object(col, jsonb_build_object('old', o -> col, 'new', n -> col));
    end if;
  end loop;

  if tg_op = 'UPDATE' and diff = '{}'::jsonb then
    return new;
  end if;

  rec_id := coalesce((n ->> 'id'), (o ->> 'id'))::uuid;
  if tg_table_name = 'clients' then
    owner := coalesce((n ->> 'owner_id'), (o ->> 'owner_id'))::uuid;
  else
    owner := rec_id;
  end if;
  actor := coalesce(auth.uid(), nullif(n ->> 'created_by', '')::uuid);

  insert into public.audit_log (actor_id, action, table_name, record_id, client_owner_id, changes)
  values (actor, tg_op, tg_table_name, rec_id, owner, diff);

  return coalesce(new, old);
end;
$$;

create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function public.write_audit();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.write_audit();

-- ---------- Row Level Security ----------
alter table public.profiles  enable row level security;
alter table public.clients   enable row level security;
alter table public.audit_log enable row level security;

-- 未登入（anon）乜都摸唔到
revoke all on public.profiles, public.clients, public.audit_log from anon;
revoke all on public.profiles, public.clients, public.audit_log from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
revoke execute on function public.handle_new_user(), public.handle_user_meta() from anon, authenticated;
grant select, delete on public.clients to authenticated;
grant insert (id, owner_id, stage, info, form_rr, form_nr1, form_nr2, form_fna, form_pc,
              rr_like_trust, rr_stable_income, rr_relationship, rr_understand_goal,
              nr2_need_confirmed, nr2_plan_previewed, nr2_budget_set, nr2_next_meeting)
  on public.clients to authenticated;
grant update (stage, info, form_rr, form_nr1, form_nr2, form_fna, form_pc,
              rr_like_trust, rr_stable_income, rr_relationship, rr_understand_goal,
              nr2_need_confirmed, nr2_plan_previewed, nr2_budget_set, nr2_next_meeting)
  on public.clients to authenticated;
grant select on public.audit_log to authenticated;
revoke execute on function public.is_admin(), public.is_active_user() from anon;

-- profiles：自己睇自己；管理員睇晒、可改名／角色／啟用狀態
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- clients：員工淨係自己嘅客（帳戶要啟用中）；管理員全部唯讀
create policy clients_select on public.clients
  for select to authenticated
  using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());

create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user());

create policy clients_update_own on public.clients
  for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user())
  with check (owner_id = auth.uid() and public.is_active_user());

create policy clients_delete_own on public.clients
  for delete to authenticated
  using (owner_id = auth.uid() and public.is_active_user());

-- audit_log：管理員睇晒；員工淨係睇到自己客嘅記錄。冇任何寫入 policy。
create policy audit_select on public.audit_log
  for select to authenticated
  using (public.is_admin() or (client_owner_id = auth.uid() and public.is_active_user()));
