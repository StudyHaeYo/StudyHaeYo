"use client"

import { PageHeader, PageShell } from "@/components/page-shell"
import { SessionIndicator, SessionTimerCard } from "@/components/study-session/session-timer"
import { TodayAgenda } from "@/components/learning-os/today-agenda"
import { TodayRecords } from "@/components/learning-os/today-records"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
import { StudyHeatmap } from "@/components/learning-os/study-heatmap"
import { TodayTimetable } from "@/components/learning-os/today-timetable"
import { useTodayLabel } from "@/hooks/use-today"
import { DataStatusNotice } from "@/components/data-status-notice"

// Home: the timer and what to do today on the left, how the weeks are going on the right. One page width (no far-off side panel),
// so wide screens don't end up with empty margins between the two. Under lg the right column stacks below.
export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  return (
    <PageShell width="wide">
      {/* No count line under the title: every count it gave is the first thing in a section below (2026-11-15). */}
      <PageHeader eyebrow={todayLabel} title="오늘의 학습 현황" actions={<SessionIndicator />} />
      <DataStatusNotice />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <SessionTimerCard />
          <TodayAgenda />
          <TodayRecords />
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          {/* Widening in time: today, this week, then the last five weeks. */}
          <TodayTimetable />
          <WeeklyStats />
          <StudyHeatmap />
        </div>
      </div>
    </PageShell>
  )
}
