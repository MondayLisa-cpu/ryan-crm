-- =====================================================================
-- 功能二 WARS 每週活動分 ＋ 功能三 PDCA
-- 喺 Supabase → SQL Editor 執行一次（要先行過 0001、0002）。
--   activity_days：每人每日 R／N／A／RR／NR／PC 次數＋午餐／下午茶／晚飯約會（加密）
--   pdca_weeks：每週 PDCA 焦點同進度（加密）
--   okrs：年度 OKR（加密）
-- 權限：員工淨係睇／改自己；主管全部唯讀。所有改動自動寫入審計記錄。
-- =====================================================================

-- ---------- 每日活動 ----------
create table public.activity_days (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  day         date not null,
  r           smallint not null default 0 check (r between 0 and 99),
  n           smallint not null default 0 check (n between 0 and 99),
  a           smallint not null default 0 check (a between 0 and 99),
  rr          smallint not null default 0 check (rr between 0 and 99),
  nr          smallint not null default 0 check (nr between 0 and 99),
  pc          smallint not null default 0 check (pc between 0 and 99),
  -- 每日分數：R1 N5 A2 RR2 NR4 PC5
  points      smallint generated always as (r * 1 + n * 5 + a * 2 + rr * 2 + nr * 4 + pc * 5) stored,
  appts       jsonb not null default '{}'::jsonb,   -- lunch / tea / dinner，每格獨立加密
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, day)
);

-- ---------- PDCA 每週 ----------
create table public.pdca_weeks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  week_start  date not null check (extract(isodow from week_start) = 1),  -- 一定係星期一
  focus       jsonb not null default '{}'::jsonb,   -- plan（宣告焦點）／ progress（焦點進度），加密
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, week_start)
);

-- ---------- 年度 OKR ----------
create table public.okrs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  year        smallint not null check (year between 2020 and 2100),
  okr         jsonb not null default '{}'::jsonb,   -- objective / key_results，加密
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, year)
);

create trigger activity_days_touch before update on public.activity_days
  for each row execute function public.touch_updated();
create trigger pdca_weeks_touch before update on public.pdca_weeks
  for each row execute function public.touch_updated();
create trigger okrs_touch before update on public.okrs
  for each row execute function public.touch_updated();

-- ---------- 審計：更新 trigger 函數，支援新表 ----------
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
  enc_cols text[] := array['info', 'form_rr', 'form_nr1', 'form_nr2', 'form_fna', 'form_pc', 'appts', 'focus', 'okr'];
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
  actor := coalesce(auth.uid(), nullif(n ->> 'created_by', '')::uuid);

  insert into public.audit_log (actor_id, action, table_name, record_id, client_owner_id, changes)
  values (actor, tg_op, tg_table_name, rec_id, owner, diff);

  return coalesce(new, old);
end;
$$;

create trigger activity_days_audit after insert or update or delete on public.activity_days
  for each row execute function public.write_audit();
create trigger pdca_weeks_audit after insert or update or delete on public.pdca_weeks
  for each row execute function public.write_audit();
create trigger okrs_audit after insert or update or delete on public.okrs
  for each row execute function public.write_audit();

-- ---------- Row Level Security ----------
alter table public.activity_days enable row level security;
alter table public.pdca_weeks    enable row level security;
alter table public.okrs          enable row level security;

revoke all on public.activity_days, public.pdca_weeks, public.okrs from anon, authenticated;

grant select, delete on public.activity_days, public.pdca_weeks, public.okrs to authenticated;
grant insert (owner_id, day, r, n, a, rr, nr, pc, appts), update (r, n, a, rr, nr, pc, appts)
  on public.activity_days to authenticated;
grant insert (owner_id, week_start, focus), update (focus) on public.pdca_weeks to authenticated;
grant insert (owner_id, year, okr), update (okr) on public.okrs to authenticated;

do $$
declare t text;
begin
  foreach t in array array['activity_days', 'pdca_weeks', 'okrs'] loop
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
