"use client"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { SessionTimerCard } from "@/components/study-session/session-timer"
import { ChecklistWidget } from "@/components/checklist-widget"
import { TodayPriority } from "@/components/learning-os/today-priority"
import { ReviewQueue } from "@/components/learning-os/review-queue"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { TodayRecords } from "@/components/learning-os/today-records"
import { WeeklyStats } from "@/components/learning-os/weekly-stats"
import { checklist as initialChecklist } from "@/lib/dummy-data"
import type { ChecklistItem } from "@/lib/types"
import { useTodayLabel } from "@/hooks/use-today"
import { DataStatusNotice } from "@/components/data-status-notice"
import { settleWrites } from "@/lib/db/queue"

export default function DashboardPage() {
  const todayLabel = useTodayLabel()
  const router = useRouter()

const handleLogout = async () => {
  // Finish pending saves while the session is still valid.
  await settleWrites()
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("로그아웃 실패:", error.message)
    return
  }

  router.replace("/login")
  router.refresh()
}
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist)

  const handleToggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar onLogout={handleLogout} />

      {/* Main column */}
      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
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
      <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border bg-sidebar px-4 py-6 xl:block">
        <ChecklistWidget items={checklist} onToggle={handleToggleCheck} />
        <WeeklyStats />
      </aside>
    </div>
  )
}
