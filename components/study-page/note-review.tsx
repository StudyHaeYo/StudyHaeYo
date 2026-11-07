"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, X } from "lucide-react"
import { addPageRecord, updatePage, useWorkspace } from "@/lib/workspace"
import { examDeadlines, reviewCandidates } from "@/lib/study-candidates"
import {
  computePageStats,
  formatDate,
  newRecordId,
  nextReviewDate,
  pageKind,
  understandingLabel,
  understandingLevels,
  type StudyPage,
} from "@/lib/study-pages"
import { reviewOffsetDays } from "@/lib/learning-os"
import {
  reviewHref,
  reviewItems,
  reviewRecordText,
  reviewSummary,
  reviewUnderstanding,
  sectionUnder,
  type JudgedItem,
  type Judgment,
  type ReviewCue,
  type ReviewItem,
} from "@/lib/review"
import type { ReviewView } from "@/components/study-page/review-marks"

// 복습 inside the note (D-34): the note stays as it was written, its answers covered in place. This holds the
// review's state for the note page: what is reviewed, what was opened and marked, and the result once finished.

interface Session {
  cue: ReviewCue
  items: ReviewItem[]
  before: number | null
  startedAt: number
}

export interface ReviewOutcome {
  before: number | null
  after: number
  rows: JudgedItem[]
  cue: ReviewCue
  recordId: string
}

export function useNoteReview({
  page,
  reviewing,
  problemsOn,
  today,
}: {
  page: StudyPage | undefined
  reviewing: boolean
  problemsOn: boolean
  today: string | null
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const [marks, setMarks] = useState<Record<string, Judgment>>({})
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null)
  const ready = !!page && !!today

  // The items are fixed when the review starts: marking a problem 맞힘 must not take it out from under the user.
  useEffect(() => {
    if (!reviewing) {
      setSession(null)
      return
    }
    if (session || !ready || !page || !today) return
    const { cue, items } = reviewItems(page, problemsOn && pageKind(page) === "wrong-answers")
    setSession({ cue, items, before: computePageStats(page, today).understanding, startedAt: Date.now() })
    setOpened({})
    setMarks({})
    setOutcome(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, ready, session])

  const view: ReviewView | undefined =
    reviewing && session && page && session.cue !== "none"
      ? {
          items: new Set(session.items.map((i) => i.blockId)),
          covered:
            session.cue === "headings"
              ? new Set(session.items.filter((i) => !opened[i.blockId]).flatMap((i) => sectionUnder(page.blocks, i.blockId)))
              : new Set(),
          opened,
          marks,
          onOpen: (id) => setOpened((o) => ({ ...o, [id]: true })),
          onMark: (id, judgment) => setMarks((m) => ({ ...m, [id]: judgment })),
        }
      : undefined

  const marked = session ? session.items.filter((i) => marks[i.blockId]).length : 0

  // One record for the review. `picked`: the 이해도 chosen when there was nothing to recall from.
  const finish = (picked?: number) => {
    if (!session || !page || !today) return
    const rows: JudgedItem[] = session.items.map((item) => ({ item, judgment: marks[item.blockId] ?? "wrong", written: false }))
    const after = session.cue === "none" ? (picked ?? 3) : reviewUnderstanding(rows)
    const recordId = newRecordId()
    addPageRecord(page.id, {
      id: recordId,
      pageId: page.id,
      date: today,
      createdAt: Date.now(),
      durationMinutes: Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000)),
      understanding: after,
      ...reviewRecordText(rows, session.cue),
      nextSteps: "",
      tags: [],
    })
    setOutcome({ before: session.before, after, rows, cue: session.cue, recordId })
    setSession(null)
  }

  // Takes the record back (the problem marks stay: they were the user's own marks on the note).
  const undo = () => {
    if (!outcome || !page) return
    updatePage(page.id, (p) => ({ ...p, studyRecords: p.studyRecords.filter((r) => r.id !== outcome.recordId) }))
    setOutcome(null)
  }

  return {
    view,
    session,
    total: session?.items.length ?? 0,
    marked,
    finish,
    outcome,
    undo,
    dismiss: () => setOutcome(null),
  }
}

const smallButton =
  "inline-flex h-[26px] items-center rounded-md bg-action-600 px-2.5 text-xs font-semibold text-action-foreground transition-colors hover:bg-action-700 disabled:cursor-not-allowed disabled:opacity-50"

// In the top bar while reviewing, in place of the status chip.
export function ReviewBar({
  marked,
  total,
  cue,
  onFinish,
  exitHref,
}: {
  marked: number
  total: number
  cue: ReviewCue
  onFinish: () => void
  exitHref: string
}) {
  const left = total - marked
  return (
    <span className="flex items-center gap-1">
      <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-action-200 bg-action-50 pl-2.5 pr-[3px] text-[13px] font-semibold text-action-800">
        <span aria-live="polite">
          {cue === "none" ? (
            "복습 중"
          ) : (
            <>
              {/* A phone's top bar has no room for the words; the count says it. */}
              <span className="hidden sm:inline">복습 중 · </span>
              {marked}/{total}
            </>
          )}
        </span>
        {cue !== "none" && (
          <button
            type="button"
            onClick={onFinish}
            disabled={left > 0}
            title={left > 0 ? `${left}개를 더 고르면 마칠 수 있어요` : "고른 결과로 학습 기록을 남겨요"}
            className={smallButton}
          >
            복습 마치기
          </button>
        )}
      </span>
      <Link
        href={exitHref}
        replace
        scroll={false}
        className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        그만두기
      </Link>
    </span>
  )
}

const callout = "flex flex-col gap-3 rounded-lg bg-muted/60 px-4 py-3.5 text-sm leading-relaxed print:hidden"

// Under the title while reviewing: how it works here, or the 1–5 choice when there is nothing to recall from.
export function ReviewGuide({ cue, items, onPick }: { cue: ReviewCue; items: ReviewItem[]; onPick: (value: number) => void }) {
  if (cue === "none")
    return (
      <div className={callout}>
        <p className="text-foreground">떠올릴 핵심 개념이나 소제목이 없어요. 노트를 다시 읽고 지금 이해도를 골라 주세요.</p>
        <div role="group" aria-label="지금 이해도" className="flex flex-wrap gap-1.5">
          {understandingLevels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(i + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-sm transition-colors hover:border-action-300 hover:bg-accent"
            >
              <span className="font-semibold tabular-nums text-foreground">{i + 1}</span>
              <span className="text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  const concepts = items.some((i) => i.type === "concept")
  const problems = items.some((i) => i.type === "problem")
  return (
    <div className={callout}>
      <p className="text-foreground">
        {cue === "headings"
          ? "소제목 아래 내용을 가려 두었어요. 무엇을 적었는지 떠올려 보고 펼쳐서 맞춰 본 뒤 떠올림 · 헷갈림 · 못 떠올림을 골라 주세요."
          : [
              concepts && "핵심 개념의 뜻을 가려 두었어요. 먼저 떠올려 보고 눌러서 맞춰 본 뒤 알았음 · 헷갈림 · 몰랐음을 골라 주세요.",
              problems && "틀린 문제는 접어 두었어요. 다시 풀어 보고 펼쳐서 맞힘 · 틀림을 골라 주세요.",
            ]
              .filter(Boolean)
              .join(" ")}{" "}
        다 고르면 위쪽의 [복습 마치기]로 기록해요.
      </p>
    </div>
  )
}

// After finishing: the result in one place, and the next note due today.
export function ReviewResult({
  page,
  outcome,
  today,
  onUndo,
  onDismiss,
}: {
  page: StudyPage
  outcome: ReviewOutcome
  today: string
  onUndo: () => void
  onDismiss: () => void
}) {
  const workspace = useWorkspace()
  const { before, after, rows, cue } = outcome
  const summary = cue === "none" ? { line: "직접 고른 이해도예요", hint: "" } : reviewSummary(rows, after)
  const problemRows = rows.filter((r) => r.item.type === "problem")
  const solved = problemRows.length > 0 && problemRows.every((r) => r.judgment === "right")
  const planned = nextReviewDate(today, after)
  const examBy = examDeadlines(workspace, today).get(page.id)?.reviewBy ?? null
  const pulled = examBy !== null && examBy > today && planned > examBy
  const next = reviewCandidates(workspace, today).find(
    (c) => c.pageId !== page.id && (c.dueTone === "overdue" || c.dueTone === "today"),
  )
  const change = before === null ? "" : after > before ? "올랐어요" : after < before ? "내려갔어요" : "그대로예요"

  return (
    <div role="status" className={`${callout} relative pr-10`}>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="닫기"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-foreground">
          복습을 마쳤어요 · 이해도 {before === null ? "" : `${before} → `}
          {after} {understandingLabel(after)}
          {change && <span className="ml-1.5 font-normal text-muted-foreground">{change}</span>}
        </p>
        <p className="text-muted-foreground">
          {summary.line}
          {" · "}
          {solved
            ? "모든 문제를 맞혀서 다시 풀 문제가 없어요"
            : pulled
              ? `다음 복습 ${formatDate(examBy!)}(시험 전날로 당김)`
              : `다음 복습 ${formatDate(planned)}(${reviewOffsetDays[after] ?? 4}일 뒤)`}
        </p>
        {summary.hint && <p className="text-foreground">{summary.hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {next && (
          <Link href={reviewHref(next.pageId)} className="inline-flex items-center gap-1 font-semibold text-action-700 hover:underline">
            다음 복습할 노트: {next.topic}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
        <button type="button" onClick={onUndo} className="text-muted-foreground hover:text-foreground hover:underline">
          기록 되돌리기
        </button>
      </div>
    </div>
  )
}
