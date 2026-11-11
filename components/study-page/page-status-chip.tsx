"use client"

import Link from "next/link"
import { daysBetween, formatDate, type PageKind, type PageStats } from "@/lib/study-pages"
import { examCountdown } from "@/components/study-page/page-properties"

// The one thing about this note's study that matters now, in the page's top bar (D-28). Same words and colors as
// 홈의 복습할 노트 and 학습 분석의 복습 예정: amber "다시 볼 때예요" + navy [복습하기] (the same name as on
// home, reviewActionLabel). Per template: 시험 D-day for 시험 정리, 틀린 문제 + [다시 풀기] for 오답 노트.
export function PageStatusChip({
  kind,
  stats,
  today,
  reviewHref,
  problems,
  exam,
  action,
  canTryReview = false,
}: {
  kind: PageKind | null
  stats: PageStats
  today: string | null
  reviewHref: string
  problems: { total: number; wrong: number }
  exam: { date: string | undefined; ready: number; total: number; recorded: number } | null
  action: string
  // The note has something to cover but no review day yet (nothing recorded): offer a first try.
  canTryReview?: boolean
}) {
  if (!today) return null
  const due = "inline-flex h-8 items-center gap-2 rounded-lg border border-attention-200 bg-attention-50 pl-2.5 pr-[3px] text-[13px] font-semibold text-attention-800"
  const calm = "hidden h-8 items-center rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
  const button = "inline-flex h-[26px] items-center rounded-md bg-action-600 px-2.5 text-xs font-semibold text-action-foreground transition-colors hover:bg-action-700"

  if (kind === "exam" && exam) {
    const countdown = examCountdown(exam.date, today)
    // No date yet: the body starts with the 시험일 field, so the bar does not ask a second time.
    if (!exam.date) return null
    if (!countdown) return null
    const near = daysBetween(today, exam.date) <= 7
    return (
      <a
        href="#exam-scope"
        className={near ? `${due} pr-2.5` : `${calm} font-medium text-foreground`}
        title="시험 범위로 가기"
      >
        시험 {countdown}
        {exam.recorded > 0 && <span className="hidden font-medium sm:inline">· 준비 {exam.ready}/{exam.total}</span>}
      </a>
    )
  }

  if (kind === "wrong-answers") {
    if (problems.wrong === 0) return problems.total > 0 ? <span className={calm}>모두 맞혔어요</span> : null
    return (
      <span className={due}>
        <span className="hidden sm:inline">틀린 문제 {problems.wrong}</span>
        <Link href={reviewHref} className={button}>
          다시 풀기
        </Link>
      </span>
    )
  }

  // A new card note has no review day until something is recorded, so there was no way in to the cards.
  // Finishing this first try records it and starts the review days.
  if (!stats.nextReviewAt)
    return canTryReview ? (
      <Link href={reviewHref} className={`${calm} !inline-flex border border-border font-medium text-foreground`}>
        복습해 보기
      </Link>
    ) : null
  if (stats.status === "복습 필요") {
    const late = daysBetween(stats.nextReviewAt, today)
    return (
      <span className={due}>
        <span className="hidden sm:inline">{late > 0 ? "다시 볼 때예요" : "오늘 복습"}</span>
        <Link href={reviewHref} className={button}>
          {action}
        </Link>
      </span>
    )
  }
  // Just the state: the note's records open from [기록] right beside it (D-36).
  return <span className="hidden h-8 items-center px-1.5 text-[13px] text-muted-foreground sm:inline-flex">다음 복습 {formatDate(stats.nextReviewAt)}</span>
}
