-- Run against a disposable/local Supabase database after migrations 0001–0006.
-- All fixtures roll back. This test has not been run against production.
begin;
insert into auth.users(id,email) values
 ('11000000-0000-4000-a000-000000000001','planner-a@example.invalid'),
 ('11000000-0000-4000-a000-000000000002','planner-b@example.invalid'),
 ('11000000-0000-4000-a000-000000000003','planner-admin@example.invalid');
update public.profiles set role='admin' where id='11000000-0000-4000-a000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
insert into public.daily_tasks(id,day,category,info) values('11000000-0000-4000-b000-000000000001','2026-10-23','appointment','{}');
do $$ begin
  begin
    insert into public.daily_tasks(owner_id,day,category) values('11000000-0000-4000-a000-000000000002','2026-10-23','service');
    raise exception 'FAIL: can create another agent task';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-a000-000000000002","role":"authenticated"}',true);
do $$ declare n int; begin
  if exists(select 1 from public.daily_tasks where id='11000000-0000-4000-b000-000000000001') then raise exception 'FAIL: cross-owner read'; end if;
  update public.daily_tasks set status='done' where id='11000000-0000-4000-b000-000000000001';
  get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: cross-owner write'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-a000-000000000003","role":"authenticated"}',true);
do $$ declare n int; begin
  if not exists(select 1 from public.daily_tasks where id='11000000-0000-4000-b000-000000000001') then raise exception 'FAIL: admin cannot read'; end if;
  update public.daily_tasks set status='done' where id='11000000-0000-4000-b000-000000000001';
  get diagnostics n=row_count; if n<>0 then raise exception 'FAIL: admin changed agent task'; end if;
end $$;
reset role;
update public.profiles set active=false where id='11000000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-a000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.daily_tasks) then raise exception 'FAIL: inactive agent can read'; end if;
end $$;
rollback;
