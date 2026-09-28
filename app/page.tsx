"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { NotebookPen } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { RecordCard } from "@/components/record-card"
import { ChecklistWidget } from "@/components/checklist-widget"
import { StatsWidget } from "@/components/stats-widget"
import { TodayPriority } from "@/components/learning-os/today-priority"
import { ReviewQueue } from "@/components/learning-os/review-queue"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import {
  categories,
  records as initialRecords,
  checklist as initialChecklist,
  weeklyStats,
  weeklyGoal,
} from "@/lib/dummy-data"
import type { ChecklistItem } from "@/lib/types"
import { useTodayLabel } from "@/hooks/use-today"

const recordPageIds: Record<string, string> = { r1: "ds-1", r2: "os-1", r3: "eng-1", r4: "ds-2" }

export default function DashboardPage() {
  const router = useRouter()
  const todayLabel = useTodayLabel()
  // Local state stands in for Firebase-backed data in the next step.
  const [records] = useState(initialRecords)
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
      <Sidebar
        onLogout={() => console.log("[v0] logout")}
      />

      {/* Main column */}
      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <TopBar date={todayLabel} />

          <section aria-label="오늘의 학습" className="mb-8 flex flex-col gap-4">
            <TodayPriority />
            <div className="grid gap-4 md:grid-cols-2">
              <ReviewQueue />
              <SubjectMastery />
            </div>
          </section>

          <h2 className="mb-3 text-sm font-medium text-foreground">오늘의 기록</h2>

          {records.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onClick={(id) => {
                    const pageId = recordPageIds[id]
                    if (pageId) router.push(`/record/${pageId}`)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Right panel */}
      <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border bg-sidebar px-4 py-6 xl:block">
        <ChecklistWidget items={checklist} onToggle={handleToggleCheck} />
        <StatsWidget stats={weeklyStats} goal={weeklyGoal} />
      </aside>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <NotebookPen className="size-6" />
      </div>
      <h3 className="text-base font-medium text-foreground">
        아직 오늘의 학습 기록이 없어요
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        사이드바에서 과목 옆의 + 버튼을 눌러 첫 페이지를 만들어보세요.
      </p>
    </div>
  )
}
