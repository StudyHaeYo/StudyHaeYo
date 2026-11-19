"use client"

import { PageHeader, PageShell } from "@/components/page-shell"
import { SessionIndicator, SessionTimerCard } from "@/components/study-session/session-timer"
import { TodayAgenda } from "@/components/learning-os/today-agenda"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
import { useTodayLabel } from "@/hooks/use-today"
import { DataStatusNotice } from "@/components/data-status-notice"

// 오늘 (재설계 D-43): 지금 할 것 and the rest of the day on the left, the timer and this week on the right.
// The DOM order is the phone order (지금 할 것 → 공부 타이머 → 하루 할 일 → 이번 주), so keyboard order matches what is seen;
// on wide screens the grid puts the timer beside 지금 할 것 and this week beside the list.
export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  return (
    <PageShell width="wide">
      <PageHeader eyebrow={todayLabel} title="오늘" actions={<SessionIndicator />} />
      <DataStatusNotice />

      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TodayAgenda
          nowClassName="min-w-0 lg:col-start-1 lg:row-start-1"
          between={
            <div className="min-w-0 lg:col-start-2 lg:row-start-1">
              <SessionTimerCard />
            </div>
          }
          listClassName="min-w-0 lg:col-start-1 lg:row-start-2"
        />
        {/* This week in one line; the five-week calendar is on 학습 분석 and 오늘의 기록 on 학습 기록. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <WeeklyStats />
        </div>
      </div>
    </PageShell>
  )
}
