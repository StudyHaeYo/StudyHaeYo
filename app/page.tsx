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

export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />

      {/* Main column + right panel (the panel moves below the main column under xl) */}
      <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-2xl">
            <TopBar date={todayLabel} />
            <DataStatusNotice />
            <TodayAgenda />
            <SessionTimerCard />

            <TodayRecords />
          </div>
        </main>

        {/* Right panel */}
        <aside className="shrink-0 border-t border-border px-4 py-6 xl:w-72 xl:border-l xl:border-t-0 xl:px-6">
          <div className="mx-auto grid max-w-2xl gap-8 sm:grid-cols-2 xl:flex xl:max-w-none xl:flex-col xl:gap-0 xl:divide-y xl:divide-border xl:[&>*]:py-6 xl:[&>*:first-child]:pt-0">
            <StudyHeatmap />
            <WeeklyStats />
          </div>
        </aside>
      </div>
    </div>
  )
}
