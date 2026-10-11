"use client"

import { AlertTriangle, CalendarClock, Clock, FileText, Gauge, History } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import { recentActivity, reviewQueue, upcomingReviews } from "@/lib/learning-os"
import { formatDuration, unresolvedConfusionCount } from "@/lib/study-pages"
import { useWorkspace } from "@/lib/workspace"
import { unrecordedSessionMinutes, useStudySession } from "@/lib/study-session"

export default function AnalyticsPage() {
  const { pages } = useWorkspace()
  const records = pages.flatMap((p) => p.studyRecords)
  const unresolvedByPage = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId)
    return page ? unresolvedConfusionCount(page) : 0
  }
  const session = useStudySession()
  const sessionMinutes = unrecordedSessionMinutes(session, records, Date.now())
  const totalMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0) + sessionMinutes
  const averageUnderstanding =
    records.length > 0 ? (records.reduce((sum, r) => sum + r.understanding, 0) / records.length).toFixed(1) : "-"

  const summaryCards: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
    { label: "총 학습 시간", value: formatDuration(totalMinutes), hint:
        sessionMinutes > 0
          ? `학습 기록 + 기록 전 타이머 세션 ${formatDuration(sessionMinutes)}`
          : "학습 기록의 학습 시간 합계",
      icon: Clock,
    },
    { label: "학습 기록 수", value: `${records.length}개`, hint: "전체 페이지 기준", icon: FileText },
    { label: "평균 이해도", value: `${averageUnderstanding} / 5`, hint: "전체 기록 기준", icon: Gauge },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar onLogout={() => console.log("[v0] logout")} />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">학습 분석</h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              학습 상태를 바탕으로 취약한 영역과 다음 복습 일정을 확인해보세요.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            {summaryCards.map(({ label, value, hint, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 text-indigo-600" />
                  {label}
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SubjectMastery title="과목별 학습 상태" />

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <h2 className="text-sm font-medium text-card-foreground">취약 학습 영역</h2>
              </div>
              <ul className="flex flex-col gap-2">
                {reviewQueue.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/record/${item.pageId}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground">{item.subject}</span>
                        <span className="px-1.5 text-muted-foreground">·</span>
                        <span className="font-medium text-card-foreground">{item.topic}</span>
                        <span className="ml-2 text-xs text-muted-foreground">이해도 {item.understanding}/5</span>
                        {unresolvedByPage(item.pageId) > 0 && (
                          <span className="ml-2 text-xs font-medium text-amber-700">
                            {`미해결 헷갈린 점 ${unresolvedByPage(item.pageId)}개`}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        보강 필요
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock className="size-4 text-indigo-600" />
                <h2 className="text-sm font-medium text-card-foreground">복습 예정</h2>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {upcomingReviews.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/record/${item.pageId}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-card-foreground">{item.topic}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{item.subject}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-indigo-600">{item.date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <History className="size-4 text-indigo-600" />
                <h2 className="text-sm font-medium text-card-foreground">최근 학습 활동</h2>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {recentActivity.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/record/${item.pageId}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-card-foreground">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.subject} · {item.when}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">이해도 {item.understanding}/5</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
