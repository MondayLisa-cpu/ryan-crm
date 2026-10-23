-- Daily planner. Review/apply from terminal before deploying the new routes.
begin;
create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  day date not null,
  category text not null check(category in ('appointment','planning','review','preparation','service')),
  stage text not null default '' check(stage in ('','relationship','needs','presentation','closing','recruitment')),
  status text not null default 'planned' check(status in ('planned','done','blocked','cancelled')),
  info jsonb not null default '{}', -- encrypted name, original plan, result; existing audit redacts info
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Keep the original plan immutable even for direct API clients.
create function public.protect_daily_task_plan()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.owner_id is distinct from old.owner_id or new.day is distinct from old.day
     or new.category is distinct from old.category or new.stage is distinct from old.stage
     or (new.info - 'result') is distinct from (old.info - 'result') then
    raise exception '原本計劃唔可以覆寫；請取消舊計劃再新增';
  end if;
  return new;
end;
$$;
create trigger daily_tasks_protect before update on public.daily_tasks
  for each row execute function public.protect_daily_task_plan();
revoke all on function public.protect_daily_task_plan() from public,anon,authenticated;
create index daily_tasks_owner_day on public.daily_tasks(owner_id,day);
create trigger daily_tasks_touch before update on public.daily_tasks for each row execute function public.touch_updated();
create trigger daily_tasks_audit after insert or update or delete on public.daily_tasks for each row execute function public.write_audit();
alter table public.daily_tasks enable row level security;
revoke all on public.daily_tasks from anon, authenticated;
grant select on public.daily_tasks to authenticated;
grant insert(id,owner_id,day,category,stage,info), update(status,info) on public.daily_tasks to authenticated;
create policy daily_tasks_select on public.daily_tasks for select to authenticated
  using ((owner_id=auth.uid() and public.is_active_user()) or public.is_admin());
create policy daily_tasks_insert on public.daily_tasks for insert to authenticated
  with check(owner_id=auth.uid() and public.is_active_user());
create policy daily_tasks_update on public.daily_tasks for update to authenticated
  using(owner_id=auth.uid() and public.is_active_user()) with check(owner_id=auth.uid() and public.is_active_user());

-- A receipt makes confirmation retries safe even after a lost network response.
create table public.wa_task_receipts (draft_id uuid primary key references public.wa_drafts(id), owner_id uuid not null references public.profiles(id));
alter table public.wa_task_receipts enable row level security;
revoke all on public.wa_task_receipts from public, anon, authenticated;
create function public.wa_save_tasks(p_actor uuid, p_draft uuid, p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; affected int;
begin
  perform public.wa_begin(p_actor);
  if not exists(select 1 from public.wa_drafts where id=p_draft and owner_id=p_actor and status='applied') then
    raise exception '草稿未確認';
  end if;
  insert into public.wa_task_receipts values(p_draft,p_actor) on conflict do nothing;
  get diagnostics affected=row_count;
  if affected=0 then return; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception '待辦資料無效'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then raise exception '待辦資料無效'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception '同一待辦唔可以重複提交';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if item->>'operation'='create' then
      insert into public.daily_tasks(id,owner_id,day,category,stage,status,info)
      values((item->>'id')::uuid,p_actor,(item->>'day')::date,item->>'category',item->>'stage',item->>'status',item->'info');
    elsif item->>'operation'='update' then
      update public.daily_tasks set status=item->>'status', info=item->'info'
      where id=(item->>'id')::uuid and owner_id=p_actor and updated_at=(item->>'updated_at')::timestamptz;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception '待辦已更新，請重新整理訊息'; end if;
    else raise exception '操作無效'; end if;
  end loop;
end;
$$;
revoke all on function public.wa_save_tasks(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wa_save_tasks(uuid,uuid,jsonb) to service_role;
commit;
