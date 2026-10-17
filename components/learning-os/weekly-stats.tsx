"use client"

import { BarChart3 } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"
import { weeklyStats } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function WeeklyStats() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const stats = today ? weeklyStats(workspace, today) : null

  const total = stats?.totalMinutes ?? 0
  const percent = Math.min(Math.round((total / WEEKLY_GOAL_MINUTES) * 100), 100)
  const max = Math.max(...(stats?.subjects.map((s) => s.minutes) ?? []), 1)

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-card-foreground">
        <BarChart3 className="size-4 text-indigo-600" />
        이번 주 학습 통계
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">월요일부터 오늘까지 · 과목별 학습 시간</p>

      {stats === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-6 animate-pulse rounded bg-muted" />
          <div className="h-6 animate-pulse rounded bg-muted" />
        </div>
      ) : stats.subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">이번 주에는 아직 학습 기록이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stats.subjects.map((s) => (
            <li key={s.subject}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{s.subject}</span>
                <span className="text-muted-foreground">{formatDuration(s.minutes)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${(s.minutes / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col items-center border-t border-border pt-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">이번 주 목표 달성률</p>
        <div
          className="relative flex items-center justify-center"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="이번 주 목표 달성률"
        >
          <svg width="110" height="110" className="-rotate-90" aria-hidden="true">
            <circle cx="55" cy="55" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="55"
              cy="55"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE}
              className="stroke-indigo-600 transition-all duration-500"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-semibold text-foreground">{stats ? `${percent}%` : "-"}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {stats ? `${formatDuration(total)} / ${formatDuration(WEEKLY_GOAL_MINUTES)}` : `목표 ${formatDuration(WEEKLY_GOAL_MINUTES)}`}
        </p>
      </div>
    </section>
  )
}
