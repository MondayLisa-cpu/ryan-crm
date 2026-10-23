-- Transactional fixtures only; no real customers or outbound messages.
begin;
insert into auth.users(id,email) values
('12000000-0000-4000-a000-000000000001','rpc-a@example.invalid'),
('12000000-0000-4000-a000-000000000002','rpc-b@example.invalid');
insert into public.wa_drafts(id,owner_id,status,payload) values
('12000000-0000-4000-b000-000000000001','12000000-0000-4000-a000-000000000001','applied','fixture'),
('12000000-0000-4000-b000-000000000002','12000000-0000-4000-a000-000000000001','applied','fixture'),
('12000000-0000-4000-b000-000000000003','12000000-0000-4000-a000-000000000001','pending','fixture'),
('12000000-0000-4000-b000-000000000004','12000000-0000-4000-a000-000000000001','applied','fixture');
do $$ declare payload jsonb; before_time timestamptz; begin
payload='[{"operation":"create","id":"12000000-0000-4000-c000-000000000001","day":"2026-10-23","category":"appointment","stage":"needs","status":"planned","info":{"name":"test","plan":"original","result":""}}]';
perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000001',payload);
perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000001',payload);
if (select count(*) from public.daily_tasks where id='12000000-0000-4000-c000-000000000001')<>1 then raise exception 'FAIL: retry duplicated task'; end if;
if not exists(select 1 from public.audit_log where record_id='12000000-0000-4000-c000-000000000001' and actor_id='12000000-0000-4000-a000-000000000001' and via='whatsapp') then raise exception 'FAIL: audit actor missing'; end if;
begin
 perform public.wa_save_tasks('12000000-0000-4000-a000-000000000002','12000000-0000-4000-b000-000000000001',payload);
 raise exception 'FAIL: wrong actor accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
begin
 perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000003',payload);
 raise exception 'FAIL: unconfirmed accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
begin
 perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000004',null);
 raise exception 'FAIL: null accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
if exists(select 1 from public.wa_task_receipts where draft_id='12000000-0000-4000-b000-000000000004') then raise exception 'FAIL: failed receipt retained'; end if;
begin
 update public.daily_tasks set info='{"name":"test","plan":"rewritten"}' where id='12000000-0000-4000-c000-000000000001';
 raise exception 'FAIL: original plan changed';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
begin
 perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000002',
 '[{"operation":"create","id":"12000000-0000-4000-c000-000000000002","day":"2026-10-23","category":"service","stage":"","status":"planned","info":{}},{"operation":"update","id":"12000000-0000-4000-c000-000000000001","updated_at":"2000-01-01T00:00:00Z","status":"done","info":{}}]');
 raise exception 'FAIL: stale batch accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
if exists(select 1 from public.daily_tasks where id='12000000-0000-4000-c000-000000000002') or exists(select 1 from public.wa_task_receipts where draft_id='12000000-0000-4000-b000-000000000002') then raise exception 'FAIL: batch partially applied'; end if;
update public.profiles set active=false where id='12000000-0000-4000-a000-000000000001';
begin
 perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000004',payload);
 raise exception 'FAIL: inactive actor accepted';
exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.wa_save_tasks('12000000-0000-4000-a000-000000000001','12000000-0000-4000-b000-000000000001','[]');
  raise exception 'FAIL: authenticated can invoke service RPC';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
