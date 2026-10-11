-- =====================================================================
-- 權限（RLS）自動測試
-- 用法：Supabase → SQL Editor → 貼晒成個檔案 → Run（要先行晒 migrations 入面所有 .sql）。
--   * 會臨時建立 4 個測試帳戶（員工 A、員工 B、管理員 R、已停用員工 C）同測試客，
--     逐項驗證權限，最後「刻意」以 error 結束，等所有測試資料自動還原（唔會留低任何嘢）。
--   * 見到「✅ 全部 RLS 測試通過」= 正常。
--   * 見到「❌ FAIL: ...」= 有權限漏洞，唔好用住，搵開發者。
-- =====================================================================
begin;

-- ---------- 準備測試帳戶（以資料庫擁有者身份） ----------
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'rls-test-a@example.invalid'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-test-b@example.invalid'),
  ('00000000-0000-4000-a000-0000000000a1', 'rls-test-admin@example.invalid'),
  ('00000000-0000-4000-a000-00000000000c', 'rls-test-c@example.invalid');

update public.profiles set role = 'admin' where id = '00000000-0000-4000-a000-0000000000a1';

insert into public.clients (id, owner_id, info) values
  ('00000000-0000-4000-c000-0000000000c1', '00000000-0000-4000-a000-00000000000c', '{"name":"v1.ccc"}');
update public.profiles set active = false where id = '00000000-0000-4000-a000-00000000000c';

-- ---------- 員工 A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

insert into public.clients (id, info) values
  ('00000000-0000-4000-c000-0000000000a1', '{"name":"v1.aaa"}');

do $$ begin
  begin
    insert into public.clients (id, owner_id, info) values
      ('00000000-0000-4000-c000-0000000000a2', '00000000-0000-4000-a000-00000000000b', '{}');
    raise exception '❌ FAIL: 員工 A 可以幫員工 B 開客';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- 員工 B ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
insert into public.clients (id, info) values
  ('00000000-0000-4000-c000-0000000000b1', '{"name":"v1.bbb"}');

do $$ begin
  if (select count(*) from public.clients) <> 1 then
    raise exception '❌ FAIL: 員工 B 睇到唔屬於自己嘅客';
  end if;
  if exists (select 1 from public.clients where id = '00000000-0000-4000-c000-0000000000a1') then
    raise exception '❌ FAIL: 員工 B 用 ID 都攞到員工 A 嘅客';
  end if;
end $$;

-- ---------- 返去員工 A：嘗試攞／改／刪員工 B 嘅客 ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  if (select count(*) from public.clients) <> 1 then
    raise exception '❌ FAIL: 員工 A 睇到 % 個客（應該得 1 個）', (select count(*) from public.clients);
  end if;

  update public.clients set stage = 'PC' where id = '00000000-0000-4000-c000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 A 改到員工 B 嘅客'; end if;

  delete from public.clients where id = '00000000-0000-4000-c000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 A 刪到員工 B 嘅客'; end if;

  -- 自己嘅客可以改
  update public.clients set stage = 'NR1', info = '{"name":"v1.aaa2"}' where id = '00000000-0000-4000-c000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ FAIL: 員工 A 改唔到自己嘅客'; end if;

  -- 四季：自己嘅客可以標，員工 B 嘅改唔到
  update public.clients set season = 'SUMMER' where id = '00000000-0000-4000-c000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ FAIL: 員工 A 標唔到自己客嘅四季'; end if;
  update public.clients set season = 'WINTER' where id = '00000000-0000-4000-c000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 A 改到員工 B 客嘅四季'; end if;

  -- 唔可以將自己嘅客轉俾其他人
  begin
    update public.clients set owner_id = '00000000-0000-4000-a000-00000000000b' where id = '00000000-0000-4000-c000-0000000000a1';
    raise exception '❌ FAIL: 員工 A 可以將客轉俾員工 B';
  exception when insufficient_privilege then null;
  end;

  -- 簽單條件：8 格剔晒先算
  update public.clients set rr_like_trust = true, rr_stable_income = true, rr_relationship = true, rr_understand_goal = true,
    nr2_need_confirmed = true, nr2_plan_previewed = true, nr2_budget_set = true, nr2_next_meeting = false
    where id = '00000000-0000-4000-c000-0000000000a1';
  if (select ready_to_sign from public.clients where id = '00000000-0000-4000-c000-0000000000a1') then
    raise exception '❌ FAIL: 未剔齊 8 格都標咗具備簽單條件';
  end if;
  update public.clients set nr2_next_meeting = true where id = '00000000-0000-4000-c000-0000000000a1';
  if not (select ready_to_sign from public.clients where id = '00000000-0000-4000-c000-0000000000a1') then
    raise exception '❌ FAIL: 剔齊 8 格都未標具備簽單條件';
  end if;

  -- 員工資料：淨係睇到自己，改唔到自己角色
  if (select count(*) from public.profiles) <> 1 then
    raise exception '❌ FAIL: 員工 A 睇到其他員工資料';
  end if;
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 A 可以將自己升做管理員'; end if;

  -- 審計記錄：淨係見到自己客，唔可以寫／改／刪
  if exists (select 1 from public.audit_log where client_owner_id <> '00000000-0000-4000-a000-00000000000a') then
    raise exception '❌ FAIL: 員工 A 睇到其他人嘅審計記錄';
  end if;
  if not exists (select 1 from public.audit_log where record_id = '00000000-0000-4000-c000-0000000000a1') then
    raise exception '❌ FAIL: 員工 A 睇唔到自己客嘅審計記錄';
  end if;
  begin
    insert into public.audit_log (action, table_name, record_id) values ('UPDATE', 'clients', gen_random_uuid());
    raise exception '❌ FAIL: 員工可以偽造審計記錄';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.audit_log;
    raise exception '❌ FAIL: 員工可以刪審計記錄';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- 活動分／PDCA／OKR ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
insert into public.activity_days (day, r, n, a, rr, nr, pc) values ('2026-10-05', 1, 1, 2, 1, 1, 1);
insert into public.pdca_weeks (week_start, focus) values ('2026-10-05', '{"plan":"v1.aaa"}');
insert into public.okrs (year, okr) values (2026, '{"objective":"v1.aaa"}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
insert into public.activity_days (day, a) values ('2026-10-05', 3);
do $$
declare n int;
begin
  if (select points from public.activity_days) <> 6 then
    raise exception '❌ FAIL: 活動分計錯（A 3 次應該 6 分）';
  end if;
  if (select count(*) from public.activity_days) <> 1 or exists (select 1 from public.pdca_weeks) or exists (select 1 from public.okrs) then
    raise exception '❌ FAIL: 員工 B 睇到員工 A 嘅活動／PDCA／OKR';
  end if;
  update public.activity_days set pc = 9 where owner_id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 B 改到員工 A 嘅活動分'; end if;
  begin
    insert into public.activity_days (owner_id, day, pc) values ('00000000-0000-4000-a000-00000000000a', '2026-10-06', 9);
    raise exception '❌ FAIL: 員工 B 可以幫員工 A 記活動';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.activity_days set points = 999;
    raise exception '❌ FAIL: 可以直接改分數';
  exception when insufficient_privilege or generated_always then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if (select points from public.activity_days) <> 1 + 5 + 4 + 2 + 4 + 5 then
    raise exception '❌ FAIL: 活動分計錯（R1 N5 A2 RR2 NR4 PC5）';
  end if;
  if not exists (select 1 from public.audit_log where table_name = 'activity_days' and client_owner_id = '00000000-0000-4000-a000-00000000000a') then
    raise exception '❌ FAIL: 活動分冇寫審計記錄';
  end if;
end $$;

-- ---------- 每月生意表 ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
insert into public.business_cases (month, client_id, data, afyp, revenue, commission)
  values ('2026-10-01', '00000000-0000-4000-c000-0000000000a1', '{"client_name":"v1.aaa"}', 12000, 9000, 3600);
insert into public.monthly_targets (month, cases, afyp) values ('2026-10-01', 3, 50000);
do $$ begin
  -- 唔可以連去其他員工嘅客
  begin
    insert into public.business_cases (month, client_id, afyp) values ('2026-10-01', '00000000-0000-4000-c000-0000000000b1', 1);
    raise exception '❌ FAIL: 生意表可以連去其他員工嘅客';
  exception when raise_exception then
    if sqlerrm like '❌%' then raise; end if;
  end;
  begin
    insert into public.business_cases (month, afyp) values ('2026-10-15', 1);
    raise exception '❌ FAIL: 生意表月份唔係 1 號都收';
  exception when check_violation then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  if exists (select 1 from public.business_cases) or exists (select 1 from public.monthly_targets) then
    raise exception '❌ FAIL: 員工 B 睇到員工 A 嘅生意表／目標';
  end if;
  update public.business_cases set afyp = 999999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工 B 改到員工 A 嘅生意表'; end if;
  begin
    insert into public.business_cases (owner_id, month, afyp) values ('00000000-0000-4000-a000-00000000000a', '2026-10-01', 1);
    raise exception '❌ FAIL: 員工 B 可以幫員工 A 加生意';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.audit_log where table_name = 'business_cases' and changes ? 'data.client_name'
                 and client_owner_id = '00000000-0000-4000-a000-00000000000a') then
    raise exception '❌ FAIL: 生意表冇寫審計記錄';
  end if;
end $$;
set local role authenticated;

-- ---------- WhatsApp 草稿同代寫函數 ----------
reset role;
select set_config('request.jwt.claims', '', true);  -- 模擬伺服器（冇登入身份）
insert into public.wa_drafts (owner_id, payload) values ('00000000-0000-4000-a000-00000000000a', 'v1.secret');
-- 伺服器代員工 A 寫入自己嘅客：成功，審計記錄標明 whatsapp 同員工 A
select public.wa_save_client('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-c000-0000000000a1', '{"season": "AUTUMN"}'::jsonb, false);
do $$ begin
  if not exists (
    select 1 from public.audit_log
    where record_id = '00000000-0000-4000-c000-0000000000a1' and via = 'whatsapp'
      and actor_id = '00000000-0000-4000-a000-00000000000a' and changes -> 'season' ->> 'new' = 'AUTUMN'
  ) then
    raise exception '❌ FAIL: WhatsApp 寫入冇正確記審計（via／actor）';
  end if;
  -- 代員工 B 改員工 A 嘅客：一定要失敗
  begin
    perform public.wa_save_client('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-c000-0000000000a1', '{"stage": "PC"}'::jsonb, false);
    raise exception '❌ FAIL: WhatsApp 函數可以改其他員工嘅客';
  exception when raise_exception then
    if sqlerrm like '❌%' then raise; end if;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
do $$
declare n int;
begin
  if exists (select 1 from public.wa_drafts) then
    raise exception '❌ FAIL: 員工 B 睇到員工 A 嘅 WhatsApp 草稿';
  end if;
  begin
    perform public.wa_save_client('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-c000-0000000000b1', '{}'::jsonb, false);
    raise exception '❌ FAIL: 員工可以直接呼叫 WhatsApp 代寫函數';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.wa_drafts (owner_id, payload) values ('00000000-0000-4000-a000-00000000000b', 'x');
    raise exception '❌ FAIL: 員工可以直接寫 WhatsApp 草稿';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set whatsapp = '85299999999' where id = '00000000-0000-4000-a000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 員工可以自己改 WhatsApp 號碼（應該由主管設定）'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.wa_drafts) <> 1 then
    raise exception '❌ FAIL: 員工 A 睇唔到自己嘅 WhatsApp 草稿';
  end if;
end $$;

-- ---------- 已停用員工 C ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.clients) then
    raise exception '❌ FAIL: 已停用員工仲睇到客';
  end if;
  begin
    insert into public.clients (info) values ('{}');
    raise exception '❌ FAIL: 已停用員工仲可以開客';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- 管理員 R ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
do $$
declare n int;
begin
  if (select count(*) from public.clients
      where id in ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-c000-0000000000b1', '00000000-0000-4000-c000-0000000000c1')) <> 3 then
    raise exception '❌ FAIL: 管理員睇唔晒所有員工嘅客';
  end if;
  update public.clients set stage = 'ISSUED' where id = '00000000-0000-4000-c000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 管理員改到員工嘅客（應該唯讀）'; end if;
  delete from public.clients where id = '00000000-0000-4000-c000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 管理員刪到員工嘅客（應該唯讀）'; end if;

  update public.profiles set active = false where id = '00000000-0000-4000-a000-00000000000b';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ FAIL: 管理員停用唔到員工'; end if;
  begin
    update public.profiles set active = false where id = '00000000-0000-4000-a000-0000000000a1';
    raise exception '❌ FAIL: 管理員可以停用自己';
  exception when raise_exception then
    if sqlerrm like '❌%' then raise; end if;
  end;
  if not exists (select 1 from public.audit_log where record_id = '00000000-0000-4000-c000-0000000000b1') then
    raise exception '❌ FAIL: 管理員睇唔到員工嘅審計記錄';
  end if;
  if (select count(*) from public.activity_days where owner_id::text like '00000000-0000-4000-a000-%') <> 2
     or (select count(*) from public.pdca_weeks where owner_id::text like '00000000-0000-4000-a000-%') <> 1
     or (select count(*) from public.okrs where owner_id::text like '00000000-0000-4000-a000-%') <> 1 then
    raise exception '❌ FAIL: 管理員睇唔晒員工嘅活動／PDCA／OKR';
  end if;
  update public.activity_days set r = 50 where owner_id::text like '00000000-0000-4000-a000-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 管理員改到員工嘅活動分（應該唯讀）'; end if;
  update public.profiles set whatsapp = '85291234567' where id = '00000000-0000-4000-a000-00000000000a';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '❌ FAIL: 管理員設定唔到員工 WhatsApp 號碼'; end if;
  update public.pdca_weeks set focus = '{}' where owner_id::text like '00000000-0000-4000-a000-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 管理員改到員工嘅 PDCA（應該唯讀）'; end if;
  if (select count(*) from public.business_cases where owner_id::text like '00000000-0000-4000-a000-%') <> 1 then
    raise exception '❌ FAIL: 管理員睇唔到員工嘅生意表';
  end if;
  update public.business_cases set afyp = 1 where owner_id::text like '00000000-0000-4000-a000-%';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '❌ FAIL: 管理員改到員工嘅生意表（應該唯讀）'; end if;
end $$;

-- 員工 B 被停用後即刻睇唔到自己嘅客
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.clients) then
    raise exception '❌ FAIL: 員工 B 停用後仲睇到客';
  end if;
end $$;

-- ---------- 未登入（anon） ----------
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.clients;
    raise exception '❌ FAIL: 未登入都讀到客戶表';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.profiles;
    raise exception '❌ FAIL: 未登入都讀到員工表';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.activity_days;
    raise exception '❌ FAIL: 未登入都讀到活動分';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- 審計內容檢查 ----------
reset role;
do $$ begin
  if not exists (
    select 1 from public.audit_log
    where record_id = '00000000-0000-4000-c000-0000000000a1'
      and action = 'UPDATE'
      and actor_id = '00000000-0000-4000-a000-00000000000a'
      and changes -> 'stage' ->> 'old' = 'RR'
      and changes -> 'stage' ->> 'new' = 'NR1'
      and changes ? 'info.name'
  ) then
    raise exception '❌ FAIL: 審計記錄冇正確記低「邊個改咗乜」';
  end if;
  if not exists (
    select 1 from public.audit_log
    where record_id = '00000000-0000-4000-c000-0000000000a1'
      and changes -> 'season' ->> 'new' = 'SUMMER'
  ) then
    raise exception '❌ FAIL: 審計記錄冇記低四季變更';
  end if;
  if exists (select 1 from public.audit_log where changes::text like '%v1.aaa%') then
    raise exception '❌ FAIL: 審計記錄抄低咗密文';
  end if;
end $$;

-- 全部通過：用 error 結束，令以上所有測試資料自動還原
do $$ begin
  raise exception '✅ 全部 RLS 測試通過（呢個 error 係刻意嘅，用嚟還原測試資料，資料庫冇任何改動）';
end $$;

rollback;
