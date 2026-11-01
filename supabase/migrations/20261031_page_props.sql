-- 템플릿별 값(D-27). Supabase SQL Editor에서 한 번 실행한다. 기존 행과 데이터는 바꾸지 않는다.
-- 노트 종류(props.kind)와 주차 · 강의 자료 · 출처 · 시험일 · 범위 같은 템플릿별 값을 담는다.
-- template_id는 지금처럼 'study-note' | 'blank'만 쓴다(옛 빌드 호환).
-- RLS는 행 단위라 새 칸에 따로 정책이 필요 없다.
alter table public.workspace_nodes
  add column if not exists props jsonb not null default '{}'::jsonb;
