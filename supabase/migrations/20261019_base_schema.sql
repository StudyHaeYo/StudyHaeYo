-- 기본 스키마: 처음에 SQL Editor로 만든 테이블 4개와 권한 정책(RLS), 함수, 트리거.
-- 2026-11-06 사이트 DB(studyhaeyo)에서 그대로 옮겨 적었다. 새로 바꾸는 것은 없다.
-- 이 파일 다음에 20261021_todos.sql부터 날짜 순서로 돌리면 사이트 DB와 같은 구조가 된다.
-- 이미 있는 DB에서 다시 돌려도 아무것도 바뀌지 않는다(if not exists, 정책은 지우고 같은 내용으로 다시 만든다).
--
-- 규칙(docs/DATA_MODEL.md "DB"):
-- - 모든 행은 user_id로 소유자를 가리키고, 본인 행만 읽고 쓴다(RLS).
-- - 노드끼리, 기록과 노드는 (id, user_id)로 이어서 남의 노드를 가리킬 수 없다.
-- - 폴더 · 과목 행은 페이지 칸을 비워 둔다(workspace_nodes_check).

-- 1) 프로필: 가입하면 트리거가 만든다.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- 2) 사이드바의 폴더 · 과목 · 페이지(노트). 한 테이블에 kind로 나눈다.
create table if not exists public.workspace_nodes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  kind text not null check (kind = any (array['folder', 'subject', 'page'])),
  title text not null default '',
  position integer not null default 0,
  template_id text check (template_id = any (array['study-note', 'blank'])),
  created_on date,
  study_type text,
  blocks jsonb,
  note jsonb,                  -- 옛 학습 노트 본문. 읽기만 한다(D-23)
  tags text[],
  status text,
  understanding integer check (understanding >= 1 and understanding <= 5),
  study_enabled boolean,       -- D-30에서 화면에서 없앰. 옛 빌드를 위해 남긴다
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_nodes_id_user_id_key unique (id, user_id),
  constraint workspace_nodes_parent_id_user_id_fkey
    foreign key (parent_id, user_id) references public.workspace_nodes (id, user_id) on delete cascade,
  constraint workspace_nodes_check check (
    kind = 'page'
    or (template_id is null and created_on is null and study_type is null and blocks is null and note is null
        and tags is null and status is null and understanding is null and study_enabled is null)
  )
);

create index if not exists workspace_user_parent_position_idx
  on public.workspace_nodes (user_id, parent_id, position);

-- 3) 학습 기록. 노트 기록만 있던 처음 모양이다(노트 없는 기록은 20261024_subject_records.sql).
create table if not exists public.study_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  page_id uuid not null,
  study_date date not null,
  created_at timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  understanding integer check (understanding >= 1 and understanding <= 5),
  study_content text,
  difficulties text,
  next_steps text,
  tags text[],
  constraint study_records_page_id_user_id_fkey
    foreign key (page_id, user_id) references public.workspace_nodes (id, user_id) on delete cascade
);

create index if not exists study_records_user_date_idx on public.study_records (user_id, study_date desc);
create index if not exists study_records_page_idx on public.study_records (page_id);

-- 4) 학습 계획. 대상은 전체 · 과목 하나 · 페이지 하나.
--    대상 노드는 지울 수 없다(restrict). 계획이 걸린 과목을 못 지우는 이유가 이것이다.
create table if not exists public.learning_plans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date not null,
  goal text,
  target_scope text not null default 'all' check (target_scope = any (array['all', 'subject', 'page'])),
  target_node_id uuid references public.workspace_nodes (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint learning_plans_check check (end_date >= start_date),
  constraint learning_plans_check1 check (
    (target_scope = 'all' and target_node_id is null)
    or (target_scope = any (array['subject', 'page']) and target_node_id is not null)
  )
);

create index if not exists learning_plans_user_start_date_idx on public.learning_plans (user_id, start_date);

-- 5) 권한 정책: 본인 행만. auth.uid()를 select로 감싸 행마다 다시 부르지 않게 한다.
alter table public.profiles enable row level security;
alter table public.workspace_nodes enable row level security;
alter table public.study_records enable row level security;
alter table public.learning_plans enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists "workspace_select_own" on public.workspace_nodes;
drop policy if exists "workspace_insert_own" on public.workspace_nodes;
drop policy if exists "workspace_update_own" on public.workspace_nodes;
drop policy if exists "workspace_delete_own" on public.workspace_nodes;
create policy "workspace_select_own" on public.workspace_nodes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workspace_insert_own" on public.workspace_nodes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workspace_update_own" on public.workspace_nodes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workspace_delete_own" on public.workspace_nodes
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "records_select_own" on public.study_records;
drop policy if exists "records_insert_own" on public.study_records;
drop policy if exists "records_update_own" on public.study_records;
drop policy if exists "records_delete_own" on public.study_records;
create policy "records_select_own" on public.study_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.study_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.study_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.study_records
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "plans_select_own" on public.learning_plans;
drop policy if exists "plans_insert_own" on public.learning_plans;
drop policy if exists "plans_update_own" on public.learning_plans;
drop policy if exists "plans_delete_own" on public.learning_plans;
create policy "plans_select_own" on public.learning_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "plans_insert_own" on public.learning_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plans_update_own" on public.learning_plans
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plans_delete_own" on public.learning_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 6) 가입하면 프로필 행을 만든다(이름은 가입할 때 넣은 display_name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) 계획 대상은 내 노드이고 종류가 맞아야 한다(RLS는 user_id만 보므로 남의 노드를 가리키지 못하게).
create or replace function public.check_learning_plan_owner()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.target_node_id is not null and not exists (
    select 1
    from public.workspace_nodes n
    where n.id = new.target_node_id
      and n.user_id = new.user_id
      and (
        (new.target_scope = 'subject' and n.kind = 'subject')
        or (new.target_scope = 'page' and n.kind = 'page')
      )
  ) then
    raise exception 'Invalid learning plan target';
  end if;
  return new;
end;
$$;

drop trigger if exists learning_plan_owner_check on public.learning_plans;
create trigger learning_plan_owner_check
  before insert or update of user_id, target_node_id, target_scope on public.learning_plans
  for each row execute function public.check_learning_plan_owner();
