-- 노트 밖에서 한 공부도 남기는 학습 기록 (D-24, 2026-10-25 수정)
-- 수업 · 문제집처럼 노트 없이 공부한 것도 기록한다. 과목도 선택이다(외부 학습은 아무것도 만들지 않고 남긴다).
-- 기록은 노트(page_id) · 과목(subject_id) · 둘 다 없음 중 하나다. 노트 기록의 과목은 지금처럼 노트 위치에서
-- 계산하므로, page_id가 있으면 subject_id는 비워 둔다(둘 다 채우지는 않는다).
--
-- 실행 전: study_records를 CSV로 백업해 두세요(Table Editor → Export).
-- 앱은 이 SQL이 실행되기 전에도 동작한다(subject_id 컬럼이 없으면 과목 기록만 꺼진다).

-- 1) 컬럼 추가. 타입은 workspace_nodes.id와 같아야 한다(uuid가 아니면 맞춰서 바꿔 주세요).
--    과목은 선택 연결이라, 과목을 지워도 기록(공부한 사실)은 남기고 연결만 끊는다.
alter table public.study_records
  add column if not exists subject_id uuid references public.workspace_nodes(id) on delete set null;

-- 2) 페이지 없이도 저장되도록.
alter table public.study_records
  alter column page_id drop not null;

-- 3) 노트와 과목을 둘 다 채우지는 않는다(둘 다 비어 있는 외부 학습 기록은 허용).
alter table public.study_records
  drop constraint if exists study_records_page_or_subject;
alter table public.study_records
  add constraint study_records_page_or_subject
  check (page_id is null or subject_id is null);

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

-- 되돌리기(필요할 때만): 노트 없는 기록을 먼저 지워야 page_id not null을 다시 걸 수 있다.
--   delete from public.study_records where page_id is null;
--   drop trigger if exists check_study_record_subject on public.study_records;
--   drop function if exists public.check_study_record_subject();
--   alter table public.study_records drop constraint if exists study_records_page_or_subject;
--   alter table public.study_records alter column page_id set not null;
--   alter table public.study_records drop column if exists subject_id;
