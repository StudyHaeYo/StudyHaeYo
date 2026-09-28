"use client"

import { AlertTriangle, CalendarClock, Clock, FileText, Gauge, History } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { SubjectMastery } from "@/components/learning-os/subject-mastery"
import {
  analyticsSummary,
  recentActivity,
  reviewQueue,
  upcomingReviews,
} from "@/lib/learning-os"

const totalHours = Math.floor(analyticsSummary.totalMinutes / 60)
const remainingMinutes = analyticsSummary.totalMinutes % 60

const summaryCards: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
  { label: "총 학습 시간", value: `${totalHours}시간 ${remainingMinutes}분`, hint: "이번 달 누적", icon: Clock },
  { label: "학습 기록 수", value: `${analyticsSummary.recordCount}개`, hint: "이번 달 작성", icon: FileText },
  { label: "평균 이해도", value: `${analyticsSummary.averageUnderstanding} / 5`, hint: "전체 기록 기준", icon: Gauge },
]

export default function AnalyticsPage() {
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
