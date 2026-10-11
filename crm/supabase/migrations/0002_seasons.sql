-- =====================================================================
-- 四季分類：每個客可以標 春／夏／秋／冬（未標 = null）
-- 喺 Supabase → SQL Editor 執行一次（要先行過 0001_init.sql）。
-- 權限沿用 clients 表嘅 RLS；審計 trigger 會自動記低季節變更。
-- =====================================================================
create type public.client_season as enum ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

alter table public.clients add column season public.client_season;

grant insert (season), update (season) on public.clients to authenticated;
