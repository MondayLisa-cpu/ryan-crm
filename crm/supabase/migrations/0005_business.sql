-- =====================================================================
-- 功能四：四季紅簿每月生意表
-- 喺 Supabase → SQL Editor 執行一次（要先行過 0001–0004）。
--   business_cases：每單生意（客名／產品／備註加密；AFYP、Revenue、佣金係數字方便加總）
--   monthly_targets：每人每月目標
-- 權限：員工淨係睇／改自己；主管全部唯讀。所有改動自動寫入審計記錄。
-- =====================================================================

create table public.business_cases (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  month       date not null check (extract(day from month) = 1),       -- 該月 1 號
  client_id   uuid references public.clients (id) on delete set null,  -- 可選：連去準客戶卡
  data        jsonb not null default '{}'::jsonb,                      -- client_name / product / note，加密
  afyp        numeric(14, 2) not null default 0 check (afyp >= 0),
  revenue     numeric(14, 2) not null default 0 check (revenue >= 0),
  commission  numeric(14, 2) not null default 0 check (commission >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index business_cases_owner_month_idx on public.business_cases (owner_id, month);

create table public.monthly_targets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  month       date not null check (extract(day from month) = 1),
  cases       integer not null default 0 check (cases >= 0),
  afyp        numeric(14, 2) not null default 0 check (afyp >= 0),
  revenue     numeric(14, 2) not null default 0 check (revenue >= 0),
  commission  numeric(14, 2) not null default 0 check (commission >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, month)
);

create trigger business_cases_touch before update on public.business_cases
  for each row execute function public.touch_updated();
create trigger monthly_targets_touch before update on public.monthly_targets
  for each row execute function public.touch_updated();

-- 審計：加密欄位多咗 data
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
  enc_cols text[] := array['info', 'form_rr', 'form_nr1', 'form_nr2', 'form_fna', 'form_pc', 'appts', 'focus', 'okr', 'data'];
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
  -- 有 owner_id 嘅表（客戶、活動、PDCA、OKR）記負責員工；profiles 記返自己
  owner := coalesce((n ->> 'owner_id'), (o ->> 'owner_id'), rec_id::text)::uuid;
  actor := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid, nullif(n ->> 'created_by', '')::uuid);

  insert into public.audit_log (actor_id, action, table_name, record_id, client_owner_id, changes, via)
  values (actor, tg_op, tg_table_name, rec_id, owner, diff, nullif(current_setting('app.via', true), ''));

  return coalesce(new, old);
end;
$$;

create trigger business_cases_audit after insert or update or delete on public.business_cases
  for each row execute function public.write_audit();
create trigger monthly_targets_audit after insert or update or delete on public.monthly_targets
  for each row execute function public.write_audit();

alter table public.business_cases  enable row level security;
alter table public.monthly_targets enable row level security;
revoke all on public.business_cases, public.monthly_targets from anon, authenticated;

grant select, delete on public.business_cases, public.monthly_targets to authenticated;
grant insert (id, owner_id, month, client_id, data, afyp, revenue, commission),
      update (month, client_id, data, afyp, revenue, commission) on public.business_cases to authenticated;
grant insert (owner_id, month, cases, afyp, revenue, commission),
      update (cases, afyp, revenue, commission) on public.monthly_targets to authenticated;

do $$
declare t text;
begin
  foreach t in array array['business_cases', 'monthly_targets'] loop
    execute format($p$
      create policy %1$s_select on public.%1$s for select to authenticated
        using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (owner_id = auth.uid() and public.is_active_user());
      create policy %1$s_update on public.%1$s for update to authenticated
        using (owner_id = auth.uid() and public.is_active_user())
        with check (owner_id = auth.uid() and public.is_active_user());
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (owner_id = auth.uid() and public.is_active_user());
    $p$, t);
  end loop;
end $$;

-- 連去客戶卡時，個客一定要係自己嘅（防止連去其他員工嘅客）
create or replace function public.check_case_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients where id = new.client_id and owner_id = new.owner_id
  ) then
    raise exception '只可以連去自己嘅客';
  end if;
  return new;
end;
$$;
create trigger business_cases_client_check before insert or update on public.business_cases
  for each row execute function public.check_case_client();
