"use client"

import Link from "next/link"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { weeklyStats } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"
import { RuledHeader } from "@/components/page-shell"

// This week (Monday to today): the total, today's share and how many days had study (D-51: no weekly goal). Minutes
// per day and per subject are on 학습 분석 (이번 주 그래프, 과목별 학습 상태).
export function WeeklyStats() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const stats = today ? weeklyStats(workspace, today) : null

  const total = stats?.totalMinutes ?? 0
  const todayMinutes = stats?.days.find((d) => d.isToday)?.minutes ?? 0
  const studiedDays = stats?.days.filter((d) => d.minutes > 0).length ?? 0

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
          <p className="mt-3 text-base font-semibold tabular-nums text-foreground">{formatDuration(total)}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {total === 0 ? "이번 주 기록 없음" : `오늘 ${formatDuration(todayMinutes)} · ${studiedDays}일 공부`}
          </p>
        </>
      )}
    </section>
  )
}
