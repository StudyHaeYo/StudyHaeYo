"use client"

import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"
import { weeklyStats } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

// This week (Monday to today): total against the weekly goal, minutes per day, and minutes per subject.
export function WeeklyStats() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const stats = today ? weeklyStats(workspace, today) : null

  const total = stats?.totalMinutes ?? 0
  const percent = Math.min(Math.round((total / WEEKLY_GOAL_MINUTES) * 100), 100)
  const maxDay = Math.max(...(stats?.days.map((d) => d.minutes) ?? []), 1)
  const maxSubject = Math.max(...(stats?.subjects.map((s) => s.minutes) ?? []), 1)

  return (
    <section aria-labelledby="weekly-stats-title">
      <h2 id="weekly-stats-title" className="text-[15px] font-semibold text-foreground">
        이번 주 학습
      </h2>

      {stats === null ? (
        <div className="mt-4 flex flex-col gap-3" aria-hidden="true">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatDuration(total)}</span>
            <span className="text-xs text-muted-foreground">/ 목표 {formatDuration(WEEKLY_GOAL_MINUTES)}</span>
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="이번 주 목표 달성률"
          >
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {stats.perDayToGoal === 0 ? (
              <span className="font-medium text-indigo-700">이번 주 목표를 채웠어요.</span>
            ) : (
              <>
                목표의 {percent}% · 하루 <span className="font-medium text-foreground">{formatDuration(stats.perDayToGoal)}</span>씩
                하면 이번 주에 채울 수 있어요.
              </>
            )}
          </p>

          <div className="mt-5 flex items-end gap-1.5" role="img" aria-label="요일별 학습 시간">
            {stats.days.map((day, i) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-14 w-full items-end">
                  <div
                    title={`${DAY_NAMES[i]} · ${day.minutes > 0 ? formatDuration(day.minutes) : "기록 없음"}`}
                    className={`w-full rounded-sm ${
                      day.future ? "bg-transparent" : day.minutes === 0 ? "bg-muted" : day.isToday ? "bg-indigo-600" : "bg-indigo-300"
                    }`}
                    style={{ height: day.future ? 0 : Math.max(day.minutes === 0 ? 3 : 6, Math.round((day.minutes / maxDay) * 56)) }}
                  />
                </div>
                <span className={`text-[11px] ${day.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {DAY_NAMES[i]}
                </span>
              </div>
            ))}
          </div>

          {stats.subjects.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4">
              {stats.subjects.map((s) => (
                <li key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{s.subject}</span>
                    <span className="tabular-nums text-muted-foreground">{formatDuration(s.minutes)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(s.minutes / maxSubject) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
