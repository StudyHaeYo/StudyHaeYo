"use client"

import Link from "next/link"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"
import { weeklyStats } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"
import { RuledHeader } from "@/components/page-shell"

// This week (Monday to today) in one line: the total against the weekly goal and, while it isn't met, how much a day
// fills it (UI 개선 1번 ③, 2026-11-18). Minutes per day and per subject are on 학습 분석 (이번 주 그래프, 과목별 학습 상태).
export function WeeklyStats() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const stats = today ? weeklyStats(workspace, today) : null

  const total = stats?.totalMinutes ?? 0
  const percent = Math.min(Math.round((total / WEEKLY_GOAL_MINUTES) * 100), 100)

  return (
    <section aria-labelledby="weekly-stats-title">
      <RuledHeader
        id="weekly-stats-title"
        title="이번 주 학습"
        aside={
          <Link href="/analytics" className="font-medium text-action-700 hover:underline">
            학습 분석
          </Link>
        }
      />

      {stats === null ? (
        <div className="mt-3 h-6 animate-pulse rounded bg-muted" aria-hidden="true" />
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-base font-semibold tabular-nums text-foreground">{formatDuration(total)}</span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`이번 주 목표 ${formatDuration(WEEKLY_GOAL_MINUTES)} 중 ${percent}%`}
            >
              <div className="h-full rounded-full bg-action-600 transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">{percent}%</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {stats.perDayToGoal === 0 ? (
              <span className="font-medium text-action-700">목표 {formatDuration(WEEKLY_GOAL_MINUTES)}를 채웠어요.</span>
            ) : total === 0 ? (
              // Nothing recorded this week (every new account): say what fills the bar, not a pace to keep up.
              `목표 ${formatDuration(WEEKLY_GOAL_MINUTES)} · 기록을 남기면 여기에 쌓여요.`
            ) : (
              <>
                목표 {formatDuration(WEEKLY_GOAL_MINUTES)} · 남은 날 하루 <span className="font-medium text-foreground">{formatDuration(stats.perDayToGoal)}</span>씩
              </>
            )}
          </p>
        </>
      )}
    </section>
  )
}
