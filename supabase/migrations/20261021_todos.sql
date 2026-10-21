-- 오늘의 체크리스트(할 일). Supabase SQL Editor에서 한 번 실행한다.
-- 규칙: docs/DATA_MODEL.md "할 일". 다른 테이블과 같이 본인 행만 읽고 쓴다(RLS).

create table if not exists public.todos (
  id uuid primary key,                       -- 클라이언트가 crypto.randomUUID()로 만든다
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_on date not null,                      -- 할 날짜(로컬 날짜). 못 끝내면 다음 날 목록에도 보인다
  done_at timestamptz,                       -- 완료한 시각. null이면 아직 안 함
  position integer not null default 0,       -- 같은 사용자 안의 순서
  created_at timestamptz not null default now()
);

create index if not exists todos_user_due_idx on public.todos (user_id, due_on);

alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
drop policy if exists "todos_insert_own" on public.todos;
drop policy if exists "todos_update_own" on public.todos;
drop policy if exists "todos_delete_own" on public.todos;

create policy "todos_select_own" on public.todos
  for select to authenticated using (auth.uid() = user_id);
create policy "todos_insert_own" on public.todos
  for insert to authenticated with check (auth.uid() = user_id);
create policy "todos_update_own" on public.todos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "todos_delete_own" on public.todos
  for delete to authenticated using (auth.uid() = user_id);
