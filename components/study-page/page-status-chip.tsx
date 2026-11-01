"use client"

import Link from "next/link"
import { daysBetween, formatDate, type PageKind, type PageStats } from "@/lib/study-pages"
import { examCountdown } from "@/components/study-page/page-properties"

// The one thing about this note's study that matters now, in the page's top bar (D-28). Same words and colors as
// 홈의 복습할 노트 and 학습 분석의 복습 예정: amber "N일 지남" + navy [복습하기]. Per template: 시험 D-day for
// 시험 정리, 틀린 문제 for 오답 노트.
export function PageStatusChip({
  kind,
  stats,
  today,
  reviewHref,
  problems,
  exam,
  onOpenInfo,
}: {
  kind: PageKind | null
  stats: PageStats
  today: string | null
  reviewHref: string
  problems: { total: number; wrong: number }
  exam: { date: string | undefined; ready: number; total: number } | null
  onOpenInfo: () => void
}) {
  if (!today) return null
  const due = "inline-flex h-8 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 pl-2.5 pr-[3px] text-[13px] font-semibold text-amber-800"
  const calm = "hidden h-8 items-center rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
  const action = "inline-flex h-[26px] items-center rounded-md bg-indigo-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"

  if (kind === "exam" && exam) {
    const countdown = examCountdown(exam.date, today)
    if (!exam.date)
      return (
        <button type="button" onClick={onOpenInfo} className={`${calm} !inline-flex border border-dashed border-border`}>
          시험일 정하기
        </button>
      )
    if (!countdown) return null
    const near = daysBetween(today, exam.date) <= 7
    return (
      <a
        href="#exam-scope"
        className={near ? `${due} pr-2.5` : `${calm} font-medium text-foreground`}
        title="시험 범위로 가기"
      >
        시험 {countdown}
        {exam.total > 0 && <span className="hidden font-medium sm:inline">· 준비 {exam.ready}/{exam.total}</span>}
      </a>
    )
  }

  if (kind === "wrong-answers") {
    if (problems.wrong === 0) return problems.total > 0 ? <span className={calm}>모두 맞혔어요</span> : null
    return (
      <span className={due}>
        <span className="hidden sm:inline">틀린 문제 {problems.wrong}</span>
        <Link href={reviewHref} className={action}>
          다시 풀기
        </Link>
      </span>
    )
  }

  if (!stats.nextReviewAt) return null
  if (stats.status === "복습 필요") {
    const late = daysBetween(stats.nextReviewAt, today)
    return (
      <span className={due}>
        <span className="hidden sm:inline">{late > 0 ? `복습 ${late}일 지남` : "오늘 복습"}</span>
        <Link href={reviewHref} className={action}>
          복습하기
        </Link>
      </span>
    )
  }
  return (
    <button type="button" onClick={onOpenInfo} className={calm}>
      다음 복습 {formatDate(stats.nextReviewAt)}
    </button>
  )
}
