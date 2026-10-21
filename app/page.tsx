"use client"

import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { SessionTimerCard } from "@/components/study-session/session-timer"
import { ChecklistWidget } from "@/components/checklist-widget"
import { TodayPriority } from "@/components/learning-os/today-priority"
import { ReviewQueue } from "@/components/learning-os/review-queue"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { TodayRecords } from "@/components/learning-os/today-records"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
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
            <SessionTimerCard />

            <section aria-label="오늘의 학습" className="mb-8 flex flex-col gap-4">
              <TodayPriority />
              <div className="grid gap-4 md:grid-cols-2">
                <ReviewQueue />
                <SubjectMastery />
              </div>
            </section>

            <TodayRecords />
          </div>
        </main>

        {/* Right panel */}
        <aside className="shrink-0 border-t border-border bg-sidebar px-4 py-6 xl:w-72 xl:border-l xl:border-t-0">
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2 xl:block xl:max-w-none xl:space-y-4">
            <ChecklistWidget />
            <WeeklyStats />
          </div>
        </aside>
      </div>
    </div>
  )
}
