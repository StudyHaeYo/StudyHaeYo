-- 학습 계획의 "노트마다 공부할 시각"(D-46). Supabase SQL Editor에서 한 번 실행한다.
-- 규칙: docs/DATA_MODEL.md "LearningPlan". 실행 전에도 앱은 돌아간다: 칸이 없으면 계획 창의 시각 칸이 숨고
-- 시간표에 계획 블록이 나오지 않는다(lib/db/sync.ts selectPlans).

-- [{ "pageId": uuid, "days": [0..6](월=0 ~ 일=6), "startMin": 0~1439, "durationMin": 10~720 }, ...]
-- 계획 하나에 딸린 값이라 계획 행 안에 둔다(계획을 고치거나 지우면 같이). null이면 시각을 정하지 않은 계획.
alter table public.learning_plans
  add column if not exists slots jsonb
  check (slots is null or jsonb_typeof(slots) = 'array');
