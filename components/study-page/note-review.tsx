"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
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
import {
  reviewHref,
  reviewItems,
  reviewRecordText,
  reviewSummary,
  reviewUnderstanding,
  type JudgedItem,
  type Judgment,
  type ReviewItem,
} from "@/lib/review"
import type { ReviewView } from "@/components/study-page/review-marks"

// 복습 inside the note (D-34): the note stays as it was written; what is under its headings, inside its toggles, and
// behind its 핵심 개념 is covered in place. This holds the review's state for the note page.

interface Session {
  items: ReviewItem[]
  before: number | null
  startedAt: number
}

export interface ReviewOutcome {
  before: number | null
  after: number
  rows: JudgedItem[]
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

  // Fixed when the review starts: marking a problem 맞힘 must not take it out from under the user.
  useEffect(() => {
    if (!reviewing) {
      setSession(null)
      return
    }
    if (session || !ready || !page || !today) return
    const items = reviewItems(page, problemsOn && pageKind(page) === "wrong-answers")
    setSession({ items, before: computePageStats(page, today).understanding, startedAt: Date.now() })
    setOpened({})
    setMarks({})
    setOutcome(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewing, ready, session])

  const view: ReviewView | undefined =
    reviewing && session && session.items.length > 0
      ? {
          items: new Map(session.items.map((i) => [i.blockId, i])),
          covered: new Set(session.items.filter((i) => !opened[i.blockId]).flatMap((i) => i.hides)),
          opened,
          marks,
          onOpen: (id) => setOpened((o) => ({ ...o, [id]: true })),
          onMark: (id, judgment) => setMarks((m) => ({ ...m, [id]: judgment })),
        }
      : undefined

  const marked = session ? session.items.filter((i) => marks[i.blockId]).length : 0

  // One record for the review. `picked`: the 이해도 chosen when there was nothing to cover (an empty note).
  const finish = (picked?: number) => {
    if (!session || !page || !today) return
    const rows: JudgedItem[] = session.items.map((item) => ({ item, judgment: marks[item.blockId] ?? "wrong", written: false }))
    const after = rows.length === 0 ? (picked ?? 3) : reviewUnderstanding(rows)
    const recordId = newRecordId()
    addPageRecord(page.id, {
      id: recordId,
      pageId: page.id,
      date: today,
      createdAt: Date.now(),
      durationMinutes: Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000)),
      understanding: after,
      ...reviewRecordText(rows),
      nextSteps: "",
      tags: [],
    })
    setOutcome({ before: session.before, after, rows, recordId })
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

// In the top bar while reviewing, in place of the status chip: quiet words and one small button.
export function ReviewBar({ marked, total, onFinish, exitHref }: { marked: number; total: number; onFinish: () => void; exitHref: string }) {
  const left = total - marked
  return (
    <span className="flex items-center gap-1 text-[13px]">
      {total > 0 && (
        <>
          <span aria-live="polite" className="px-1.5 tabular-nums text-muted-foreground">
            <span className="hidden sm:inline">복습 중 · </span>
            {marked}/{total}
          </span>
          <button
            type="button"
            onClick={() => left === 0 && onFinish()}
            aria-disabled={left > 0}
            title={left > 0 ? `${left}곳을 더 고르면 마칠 수 있어요` : "고른 결과로 학습 기록을 남겨요"}
            className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
              left === 0 ? "bg-action-600 text-action-foreground hover:bg-action-700" : "bg-muted text-muted-foreground"
            }`}
          >
            복습 마치기
          </button>
        </>
      )}
      <Link
        href={exitHref}
        replace
        scroll={false}
        className="inline-flex h-7 items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        그만두기
      </Link>
    </span>
  )
}

// Under the title while reviewing: one quiet line, or the 1–5 choice for a note with nothing to cover.
export function ReviewGuide({ total, onPick }: { total: number; onPick: (value: number) => void }) {
  if (total > 0)
    return (
      <p className="text-sm text-muted-foreground print:hidden">
        가려진 곳을 먼저 떠올려 보고, 회색 줄을 눌러 맞춰 보세요. 다 고르면 [복습 마치기]로 기록해요.
      </p>
    )
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <p className="text-sm text-muted-foreground">가릴 내용이 아직 없어요. 지금 이해도를 골라 기록해 두세요.</p>
      <div role="group" aria-label="지금 이해도" className="flex flex-wrap gap-1">
        {understandingLevels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(i + 1)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="font-semibold tabular-nums text-foreground">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// After finishing: the result in one quiet line, and the next note due today.
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
  const { before, after, rows } = outcome
  const summary = rows.length === 0 ? { line: "", hint: "" } : reviewSummary(rows, after)
  const problemRows = rows.filter((r) => r.item.type === "problem")
  const solved = problemRows.length > 0 && problemRows.every((r) => r.judgment === "right")
  const planned = nextReviewDate(today, after)
  const examBy = examDeadlines(workspace, today).get(page.id)?.reviewBy ?? null
  const pulled = examBy !== null && examBy > today && planned > examBy
  const next = reviewCandidates(workspace, today).find((c) => c.pageId !== page.id && (c.dueTone === "overdue" || c.dueTone === "today"))
  const nextDay = solved ? "다시 풀 문제 없음" : pulled ? `다음 복습 ${formatDate(examBy!)}(시험 전날)` : `다음 복습 ${formatDate(planned)}`

  return (
    <div role="status" className="group flex flex-col gap-1 text-sm print:hidden">
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">복습 기록됨</span>
        {[
          `이해도 ${before !== null && before !== after ? `${before} → ` : ""}${after} ${understandingLabel(after)}`,
          nextDay,
          summary.line,
        ]
          .filter(Boolean)
          .map((part) => ` · ${part}`)
          .join("")}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-3 text-muted-foreground">
        {summary.hint && <span>{summary.hint}</span>}
        {next && (
          <Link href={reviewHref(next.pageId)} className="font-medium text-action-700 hover:underline">
            다음 노트: {next.topic} →
          </Link>
        )}
        <button type="button" onClick={onUndo} className="hover:text-foreground hover:underline">
          기록 되돌리기
        </button>
        <button type="button" onClick={onDismiss} aria-label="닫기" className="inline-flex items-center hover:text-foreground">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </p>
    </div>
  )
}
