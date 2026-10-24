-- 학습 계획의 목표 시간(분). 비어 있으면 지금처럼 기간 진행으로만 보여준다.
-- 앱은 이 SQL 전에도 동작한다(목표 시간 칸만 숨겨진다).
alter table public.learning_plans
  add column if not exists goal_minutes integer check (goal_minutes is null or goal_minutes > 0);

-- 되돌리기: alter table public.learning_plans drop column if exists goal_minutes;
