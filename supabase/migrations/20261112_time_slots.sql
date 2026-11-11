-- 홈 "오늘 시간표": 할 일을 몇 시에 할지, 공부를 몇 시에 시작했는지. Supabase SQL Editor에서 한 번 실행한다.
-- 규칙: docs/DATA_MODEL.md "할 일", "학습 기록". 둘 다 비어 있어도 되는 칸이라 기존 행은 그대로다.
-- 실행 전에도 앱은 돌아간다: 칸이 없으면 시간표와 시각 고르기만 숨긴다(lib/db/sync.ts).

-- 할 일을 할 시각: 그날 0시부터 센 분(0~1439). null이면 시각을 정하지 않은 할 일.
-- 화면은 한 시간 단위로 고르지만 분으로 저장해 두어, 30분 단위로 바꿔도 칸을 고치지 않는다.
alter table public.todos
  add column if not exists start_min smallint
  check (start_min is null or (start_min >= 0 and start_min < 1440));

-- 공부를 시작한 시각. created_at은 기록을 저장한 시각이라 "몇 시에 공부했는지"는 알 수 없었다.
-- null이면 시작 시각을 모르는 기록(예전 기록, 시각 없이 남긴 기록): 시간표에 그리지 않는다.
alter table public.study_records
  add column if not exists started_at timestamptz;
