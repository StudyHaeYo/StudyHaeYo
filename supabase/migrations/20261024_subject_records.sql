-- 과목에 바로 남기는 학습 기록 (D-24)
-- 페이지 없이 공부한 것(수업, 문제집 …)도 기록할 수 있게 study_records에 subject_id를 추가한다.
-- 한 기록은 페이지(page_id) 또는 과목(subject_id) 중 하나에 붙는다. 페이지 기록의 과목은 지금처럼
-- 페이지 위치에서 계산하므로 page_id가 있으면 subject_id는 비워 둔다.
--
-- 실행 전: study_records를 CSV로 백업해 두세요(Table Editor → Export).
-- 앱은 이 SQL이 실행되기 전에도 동작한다(subject_id 컬럼이 없으면 과목 기록만 꺼진다).

-- 1) 컬럼 추가. 타입은 workspace_nodes.id와 같아야 한다(uuid가 아니면 맞춰서 바꿔 주세요).
--    과목을 지우면 그 과목의 기록도 같이 지운다(페이지 삭제 때 page_id가 cascade 되는 것과 같게).
alter table public.study_records
  add column if not exists subject_id uuid references public.workspace_nodes(id) on delete cascade;

-- 2) 페이지 없이도 저장되도록.
alter table public.study_records
  alter column page_id drop not null;

-- 3) 페이지 기록이거나 과목 기록이거나, 둘 중 하나만.
alter table public.study_records
  drop constraint if exists study_records_page_or_subject;
alter table public.study_records
  add constraint study_records_page_or_subject
  check ((page_id is not null) <> (subject_id is not null));

create index if not exists study_records_subject_id_idx on public.study_records (subject_id);

-- 4) subject_id는 내 노드이고 kind = 'subject'여야 한다.
--    (RLS는 user_id만 검사하므로, 남의 노드나 폴더를 가리키지 못하게 트리거로 막는다.)
create or replace function public.check_study_record_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subject_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.workspace_nodes n
    where n.id = new.subject_id and n.user_id = new.user_id and n.kind = 'subject'
  ) then
    raise exception 'subject_id must be one of your subjects';
  end if;
  return new;
end;
$$;

drop trigger if exists check_study_record_subject on public.study_records;
create trigger check_study_record_subject
  before insert or update of subject_id, user_id on public.study_records
  for each row execute function public.check_study_record_subject();

-- 되돌리기(필요할 때만): 과목 기록을 먼저 지워야 page_id not null을 다시 걸 수 있다.
--   delete from public.study_records where page_id is null;
--   drop trigger if exists check_study_record_subject on public.study_records;
--   drop function if exists public.check_study_record_subject();
--   alter table public.study_records drop constraint if exists study_records_page_or_subject;
--   alter table public.study_records alter column page_id set not null;
--   alter table public.study_records drop column if exists subject_id;
