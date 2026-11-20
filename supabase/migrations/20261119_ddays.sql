-- D-day: 사용자가 직접 이름과 날짜를 정하는 날(시험, 마감 등). Supabase SQL Editor에서 한 번 실행한다.
-- 규칙: docs/DATA_MODEL.md "D-day". 다른 테이블과 같이 본인 행만 읽고 쓴다(RLS).
-- 실행 전에도 앱은 돌아간다: 테이블이 없으면 오늘 시간표 [월]의 D-day 칸과 달력 표시만 숨는다(lib/db/sync.ts).

create table if not exists public.ddays (
  id uuid primary key,                       -- 클라이언트가 crypto.randomUUID()로 만든다
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  on_date date not null,                     -- 그날(로컬 날짜). 지난 D-day도 지우기 전까지 남는다
  created_at timestamptz not null default now()
);

create index if not exists ddays_user_date_idx on public.ddays (user_id, on_date);

alter table public.ddays enable row level security;

drop policy if exists "ddays_select_own" on public.ddays;
drop policy if exists "ddays_insert_own" on public.ddays;
drop policy if exists "ddays_delete_own" on public.ddays;

create policy "ddays_select_own" on public.ddays
  for select to authenticated using (auth.uid() = user_id);
create policy "ddays_insert_own" on public.ddays
  for insert to authenticated with check (auth.uid() = user_id);
create policy "ddays_delete_own" on public.ddays
  for delete to authenticated using (auth.uid() = user_id);
