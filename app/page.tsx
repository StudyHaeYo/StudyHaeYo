"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { SessionTimerCard } from "@/components/study-session/session-timer"
import { TodayAgenda } from "@/components/learning-os/today-agenda"
import { TodayRecords } from "@/components/learning-os/today-records"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
import { StudyHeatmap } from "@/components/learning-os/study-heatmap"
import { useTodayLabel } from "@/hooks/use-today"
import { DataStatusNotice } from "@/components/data-status-notice"

// Home: the timer and what to do today on the left, how the weeks are going on the right. One page width (no far-off side panel),
// so wide screens don't end up with empty margins between the two. Under lg the right column stacks below.
export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <TopBar date={todayLabel} />
          <DataStatusNotice />

          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-8">
              <SessionTimerCard />
              <TodayAgenda />
              <TodayRecords />
            </div>

            <div className="flex min-w-0 flex-col gap-8">
              <StudyHeatmap />
              <WeeklyStats />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
