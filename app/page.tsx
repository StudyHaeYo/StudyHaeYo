"use client"

import { PageHeader, PageShell } from "@/components/page-shell"
import { SessionIndicator, SessionTimerCard } from "@/components/study-session/session-timer"
import { FirstRun, TodayAgenda } from "@/components/learning-os/today-agenda"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
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
      {/* Same word as the menu (D-43). */}
      <PageHeader eyebrow={todayLabel} title="오늘" actions={<SessionIndicator />} />
      <DataStatusNotice />
      {/* A brand-new account only: above the grid so it is the first thing on a phone, before the timer. */}
      <FirstRun />

      {/* DOM order is the phone order (timer → 오늘 할 일 → 시간표 → 이번 주); on wide screens the timer sits at the top
          of the right column (D-43), and row 2 takes the list's extra height so the timetable stays under the timer. */}
      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <SessionTimerCard />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <TodayAgenda />
        </div>
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-2 lg:row-start-2">
          {/* Today, then this week in one line. 오늘의 기록 is on 학습 기록 and the five-week calendar on 학습 분석
              (UI 개선 1번 ③, 2026-11-18): home keeps what to do now. */}
          <TodayTimetable />
          <WeeklyStats />
        </div>
      </div>
    </PageShell>
  )
}
