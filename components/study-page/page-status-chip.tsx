"use client"

import Link from "next/link"
import { daysBetween, formatDate, type PageKind, type PageStats } from "@/lib/study-pages"
import { examCountdown } from "@/components/study-page/page-properties"
import { button } from "@/components/ui-styles"

// The one thing about this note's study that matters now, in the page's top bar (D-28). When it is time, one navy
// button with the same name as on home (reviewActionLabel) and an amber dot for "다시 볼 때예요" — the label and the
// button used to sit side by side as two things (D-42). Per template: 시험 D-day for 시험 정리, [다시 풀기 N] for 오답 노트.
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
  const calm = "hidden h-8 items-center rounded-lg px-2.5 text-sm text-muted-foreground sm:inline-flex"
  const dot = <span className="size-1.5 shrink-0 rounded-full bg-attention-400" aria-hidden="true" />

  if (kind === "exam" && exam) {
    const countdown = examCountdown(exam.date, today)
    // No date yet: the body starts with the 시험일 field, so the bar does not ask a second time.
    if (!exam.date) return null
    if (!countdown) return null
    const near = daysBetween(today, exam.date) <= 7
    return (
      <a
        href="#exam-scope"
        className={
          near
            ? button("secondary", "sm", "border-attention-200 bg-attention-50 font-semibold text-attention-800 hover:bg-attention-100")
            : button("ghost", "sm", "hidden text-foreground sm:inline-flex")
        }
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
      <Link href={reviewHref} aria-label={`틀린 문제 ${problems.wrong}개 다시 풀기`} className={button("primary", "sm")}>
        {dot}
        다시 풀기
        <span className="tabular-nums text-action-200">{problems.wrong}</span>
      </Link>
    )
  }

  // A new card note has no review day until something is recorded, so there was no way in to the cards.
  // Finishing this first try records it and starts the review days.
  if (!stats.nextReviewAt)
    return canTryReview ? (
      <Link href={reviewHref} className={button("secondary", "sm")}>
        복습해 보기
      </Link>
    ) : null
  if (stats.status === "복습 필요") {
    const late = daysBetween(stats.nextReviewAt, today)
    const when = late > 0 ? "다시 볼 때예요" : "오늘 복습할 날이에요"
    return (
      <Link href={reviewHref} title={when} aria-label={`${action} · ${when}`} className={button("primary", "sm")}>
        {dot}
        {action}
      </Link>
    )
  }
  // Just the state: the note's records open from ⋯ > 학습 기록 (D-36, D-42).
  return <span className={calm}>다음 복습 {formatDate(stats.nextReviewAt)}</span>
}
