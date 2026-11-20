"use client"

import { PageHeader, PageShell } from "@/components/page-shell"
import { SessionIndicator, SessionTimerCard } from "@/components/study-session/session-timer"
import { TodayAgenda } from "@/components/learning-os/today-agenda"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
import { StudyCalendar } from "@/components/learning-os/study-calendar"
import { useTodayLabel } from "@/hooks/use-today"
import { DataStatusNotice } from "@/components/data-status-notice"

// Home: the timer and what to do today on the left, how the weeks are going on the right. One page width (no far-off side panel),
// so wide screens don't end up with empty margins between the two. Under lg the right column stacks below.
export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  return (
    <PageShell width="wide">
      {/* No count line under the title: every count it gave is the first thing in a section below (2026-11-15). */}
      <PageHeader eyebrow={todayLabel} title="오늘" actions={<SessionIndicator />} />
      <DataStatusNotice />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <SessionTimerCard />
          <TodayAgenda />
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          {/* 시간표 [일 | 주 | 월]: today, the week, and the month with D-days in one card (D-44); then this week in one
              line. 오늘의 기록 is on 학습 기록 (UI 개선 1번 ③). */}
          <StudyCalendar />
          <WeeklyStats />
        </div>
      </div>
    </PageShell>
  )
}
