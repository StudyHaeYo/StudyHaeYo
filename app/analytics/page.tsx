"use client"

import { Sidebar } from "@/components/sidebar"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { AnalyticsTrend } from "@/components/learning-os/analytics-trend"
import { RecentActivity, UpcomingReviews, WeakAreas } from "@/components/learning-os/analytics-widgets"
import { formatDuration } from "@/lib/study-pages"
import { useWorkspace } from "@/lib/workspace"
import { unrecordedSessionMinutes, useStudySession } from "@/lib/study-session"

export default function AnalyticsPage() {
  const { pages } = useWorkspace()
  const records = pages.flatMap((p) => p.studyRecords)
  const session = useStudySession()
  const sessionMinutes = unrecordedSessionMinutes(session, records, Date.now(), new Set(pages.map((p) => p.id)))
  const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0) + sessionMinutes
  const averageUnderstanding =
    records.length > 0 ? (records.reduce((sum, r) => sum + r.understanding, 0) / records.length).toFixed(1) : "-"

  const summaryCards: { label: string; value: string; hint: string }[] = [
    { label: "총 학습 시간", value: formatDuration(totalMinutes), hint:
        sessionMinutes > 0
          ? `학습 기록 + 기록 전 타이머 세션 ${formatDuration(sessionMinutes)}`
          : "학습 기록의 학습 시간 합계",
    },
    { label: "학습 기록 수", value: `${records.length}개`, hint: "전체 페이지 기준" },
    { label: "평균 이해도", value: `${averageUnderstanding} / 5`, hint: "전체 기록 기준" },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">학습 분석</h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              학습 상태를 바탕으로 취약한 영역과 다음 복습 일정을 확인해보세요.
            </p>
          </header>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {summaryCards.map(({ label, value, hint }) => (
              <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5">
                <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
                <p className="mt-1 text-lg font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:mt-2 sm:text-3xl">
                  {value}
                </p>
                <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{hint}</p>
              </div>
            ))}
          </div>

          <AnalyticsTrend />

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SubjectMastery title="과목별 학습 상태" />

            <WeakAreas />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <UpcomingReviews />
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  )
}
