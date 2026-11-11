-- 홈 "오늘 시간표": 할 일을 얼마 동안 할지. Supabase SQL Editor에서 한 번 실행한다.
-- 20261112_time_slots.sql(start_min) 다음에 실행한다. 규칙: docs/DATA_MODEL.md "할 일".
-- 실행 전에도 앱은 돌아간다: 칸이 없으면 길이 고르기를 숨기고 시간표 블록을 한 시간으로 그린다(lib/db/sync.ts).

-- 길이(분). start_min과 함께 "13:30부터 90분"을 뜻한다. null이면 길이를 정하지 않은 할 일: 시간표에는 한 시간으로 그린다.
-- 끝 시각이 아니라 길이로 둔다: 시작 시각만 옮겨도 길이가 그대로 남는다.
alter table public.todos
  add column if not exists duration_min smallint
  check (duration_min is null or (duration_min >= 10 and duration_min <= 720));
