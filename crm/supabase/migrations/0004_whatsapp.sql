-- =====================================================================
-- WhatsApp 助手：員工喺 WhatsApp 講見客內容 → AI 整理 → 員工回覆「確認」→ 寫入 app
-- 喺 Supabase → SQL Editor 執行一次（要先行過 0001–0003）。
-- =====================================================================

-- 員工 WhatsApp 號碼（國家碼＋號碼，淨係數字，例如 85291234567），由主管喺「員工帳戶」設定
alter table public.profiles add column whatsapp text unique check (whatsapp ~ '^[0-9]{8,15}$');
grant update (whatsapp) on public.profiles to authenticated;

-- 審計記錄多一欄：經邊個渠道改（例如 whatsapp）
alter table public.audit_log add column via text;

-- 伺服器代員工寫入時（冇登入 session），用 app.actor 記低係邊個員工
create or replace function public.touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'clients' then
    new.updated_by := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid);
  end if;
  return new;
end;
$$;

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
  actor := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid, nullif(n ->> 'created_by', '')::uuid);

  insert into public.audit_log (actor_id, action, table_name, record_id, client_owner_id, changes, via)
  values (actor, tg_op, tg_table_name, rec_id, owner, diff, nullif(current_setting('app.via', true), ''));

  return coalesce(new, old);
end;
$$;

-- ---------- WhatsApp 草稿 ----------
create table public.wa_drafts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id),
  status      text not null default 'pending' check (status in ('pending', 'applied', 'cancelled')),
  payload     text not null,          -- 原文＋AI 整理結果，整個加密
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index wa_drafts_owner_idx on public.wa_drafts (owner_id, created_at desc);

-- 已處理過嘅 WhatsApp 訊息（防止 Meta 重送時重複處理）
create table public.wa_seen_messages (
  message_id  text primary key,
  at          timestamptz not null default now()
);

alter table public.wa_drafts        enable row level security;
alter table public.wa_seen_messages enable row level security;
revoke all on public.wa_drafts, public.wa_seen_messages from anon, authenticated;
grant select on public.wa_drafts to authenticated;

create policy wa_drafts_select on public.wa_drafts for select to authenticated
  using ((owner_id = auth.uid() and public.is_active_user()) or public.is_admin());
-- 寫入只限伺服器（service role），員工喺 app 確認／取消都係經伺服器做

-- ---------- 伺服器代員工寫入（只限 service role 呼叫） ----------
create or replace function public.wa_begin(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and active) then
    raise exception '員工帳戶唔存在或者已停用';
  end if;
  perform set_config('app.actor', p_actor::text, true);
  perform set_config('app.via', 'whatsapp', true);
end;
$$;

-- 新增或更新客戶（只可以係該員工自己嘅客）
create or replace function public.wa_save_client(p_actor uuid, p_id uuid, p_patch jsonb, p_create boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  perform public.wa_begin(p_actor);
  if p_create then
    insert into public.clients (id, owner_id, info) values (p_id, p_actor, coalesce(p_patch -> 'info', '{}'::jsonb));
  end if;
  update public.clients set
    info     = coalesce(p_patch -> 'info', info),
    form_rr  = coalesce(p_patch -> 'form_rr', form_rr),
    form_nr1 = coalesce(p_patch -> 'form_nr1', form_nr1),
    form_nr2 = coalesce(p_patch -> 'form_nr2', form_nr2),
    form_fna = coalesce(p_patch -> 'form_fna', form_fna),
    form_pc  = coalesce(p_patch -> 'form_pc', form_pc),
    stage    = coalesce((p_patch ->> 'stage')::public.client_stage, stage),
    season   = coalesce((p_patch ->> 'season')::public.client_season, season),
    rr_like_trust      = rr_like_trust      or coalesce((p_patch ->> 'rr_like_trust')::boolean, false),
    rr_stable_income   = rr_stable_income   or coalesce((p_patch ->> 'rr_stable_income')::boolean, false),
    rr_relationship    = rr_relationship    or coalesce((p_patch ->> 'rr_relationship')::boolean, false),
    rr_understand_goal = rr_understand_goal or coalesce((p_patch ->> 'rr_understand_goal')::boolean, false),
    nr2_need_confirmed = nr2_need_confirmed or coalesce((p_patch ->> 'nr2_need_confirmed')::boolean, false),
    nr2_plan_previewed = nr2_plan_previewed or coalesce((p_patch ->> 'nr2_plan_previewed')::boolean, false),
    nr2_budget_set     = nr2_budget_set     or coalesce((p_patch ->> 'nr2_budget_set')::boolean, false),
    nr2_next_meeting   = nr2_next_meeting   or coalesce((p_patch ->> 'nr2_next_meeting')::boolean, false)
  where id = p_id and owner_id = p_actor;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '搵唔到呢個員工嘅客';
  end if;
end;
$$;

-- 加活動次數（喺原有次數上面加）同更新約會
create or replace function public.wa_add_activity(p_actor uuid, p_day date, p_counts jsonb, p_appts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.wa_begin(p_actor);
  insert into public.activity_days as d (owner_id, day, r, n, a, rr, nr, pc, appts)
  values (
    p_actor, p_day,
    coalesce((p_counts ->> 'r')::int, 0), coalesce((p_counts ->> 'n')::int, 0), coalesce((p_counts ->> 'a')::int, 0),
    coalesce((p_counts ->> 'rr')::int, 0), coalesce((p_counts ->> 'nr')::int, 0), coalesce((p_counts ->> 'pc')::int, 0),
    coalesce(p_appts, '{}'::jsonb)
  )
  on conflict (owner_id, day) do update set
    r  = least(99, d.r  + excluded.r),
    n  = least(99, d.n  + excluded.n),
    a  = least(99, d.a  + excluded.a),
    rr = least(99, d.rr + excluded.rr),
    nr = least(99, d.nr + excluded.nr),
    pc = least(99, d.pc + excluded.pc),
    appts = case when p_appts is null then d.appts else p_appts end;
end;
$$;

revoke all on function public.wa_begin(uuid) from public, anon, authenticated;
revoke all on function public.wa_save_client(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.wa_add_activity(uuid, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.wa_save_client(uuid, uuid, jsonb, boolean) to service_role;
grant execute on function public.wa_add_activity(uuid, date, jsonb, jsonb) to service_role;
