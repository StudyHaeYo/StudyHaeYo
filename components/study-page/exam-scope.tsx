"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { addDays, computePageStats, formatDate, reviewActionLabel, type StudyPage } from "@/lib/study-pages"
import { noteIcon } from "@/lib/templates"
import { examCountdown } from "@/components/study-page/page-properties"
import { reviewHref } from "@/lib/review"
import { examDeadlines } from "@/lib/study-candidates"
import { useWorkspace } from "@/lib/workspace"

// 시험 정리 = 범위표 (D-27, D-30, D-35): the exam day as a calendar tile, then each note in its scope with one word
// for how well it is known and, on the right, [복습하기] when it is due or the day it comes up. Review happens in
// each note. A review planned after the exam (or none yet) comes forward to the day before the nearest exam that has
// the note in its scope — this one or another — the same rule as 홈's review list (`examDeadlines`).

// One word per note, from its 이해도. "확인됨" is the same line as 준비 n/m in the top bar (이해도 4 or more).
type ScopeState = "again" | "unchecked" | "partly" | "checked"
const scopeStates: Record<ScopeState, { word: string; dot: string; rank: number }> = {
  again: { word: "다시 확인", dot: "bg-danger-500", rank: 0 },
  // Nothing recorded yet: no way to know, so it comes right after the weak notes.
  unchecked: { word: "미확인", dot: "border-[1.5px] border-muted-foreground", rank: 1 },
  partly: { word: "일부 확인", dot: "bg-attention-500", rank: 2 },
  checked: { word: "확인됨", dot: "bg-success-600", rank: 3 },
}
// The order of the summary line under the date: what is ready first, like 준비 n/m.
const summaryOrder: ScopeState[] = ["checked", "partly", "again", "unchecked"]

function scopeState(understanding: number | null): ScopeState {
  if (understanding === null) return "unchecked"
  return understanding <= 2 ? "again" : understanding === 3 ? "partly" : "checked"
}

// The day a scope note's review comes forward to: the day before the exam (the exam day itself when it is today).
function examReviewBy(examDate: string | undefined, today: string | null) {
  return examDate && today && examDate >= today ? (examDate > today ? addDays(examDate, -1) : today) : null
}

type Deadlines = ReturnType<typeof examDeadlines>

// The day each scope note's review comes forward to: the eve of the nearest upcoming exam it is in (home's rule).
// `byOther` names that exam when it is not this one, so the table can say whose eve it is.
export function useScopeDeadlines(today: string | null): Deadlines | null {
  const workspace = useWorkspace()
  return today ? examDeadlines(workspace, today) : null
}

// The scope notes in the table's order: what needs checking first, then the nearest review. "시험 전에 다시 볼 것"
// lists them in the same order.
export function scopeRows(scope: StudyPage[], examDate: string | undefined, today: string | null, deadlines: Deadlines | null, examId: string) {
  const own = examReviewBy(examDate, today)
  return scope
    .map((page) => {
      const stats = computePageStats(page, today)
      const other = deadlines?.get(page.id)
      // The nearest eve: another exam's when it comes first, else this exam's own.
      const byOther = other && other.examId !== examId && (own === null || other.reviewBy < own) ? other.examTitle : null
      const reviewBy = byOther ? other!.reviewBy : own
      const pulled = reviewBy !== null && (stats.nextReviewAt === null || stats.nextReviewAt > reviewBy)
      const next = pulled ? reviewBy : stats.nextReviewAt
      const due = stats.status === "복습 필요" || (!!today && !!next && next <= today)
      return { page, stats, next, pulled, pulledBy: pulled ? byOther : null, due, state: scopeState(stats.understanding) }
    })
    .sort(
      (a, b) =>
        scopeStates[a.state].rank - scopeStates[b.state].rank ||
        (a.next ?? "9999-12-31").localeCompare(b.next ?? "9999-12-31") ||
        (a.page.title || "").localeCompare(b.page.title || "", "ko"),
    )
}

export function ExamScope({
  examId,
  examDate,
  onChangeDate,
  scope,
  options,
  onChangeScope,
  today,
}: {
  examId: string
  examDate: string | undefined
  onChangeDate: (date: string | undefined) => void
  scope: StudyPage[]
  // Notes that can go in the scope (same subject first).
  options: { id: string; title: string }[]
  onChangeScope: (ids: string[]) => void
  today: string | null
}) {
  const countdown = examCountdown(examDate, today)
  const past = !!examDate && !!today && examDate < today
  const reviewBy = examReviewBy(examDate, today)
  const deadlines = useScopeDeadlines(today)
  const rows = scopeRows(scope, examDate, today, deadlines, examId)
  const counts = summaryOrder
    .map((s) => ({ s, n: rows.filter((r) => r.state === s).length }))
    .filter((c) => c.n > 0)
    .map((c) => `${scopeStates[c.s].word} ${c.n}`)
  const ids = scope.map((p) => p.id)
  const rest = options.filter((o) => !ids.includes(o.id))

  // The date field shows while there is no date, and after [시험일 바꾸기] until it loses focus.
  const [editing, setEditing] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) dateRef.current?.focus()
  }, [editing])
  const showField = !examDate || editing

  return (
    <section aria-labelledby="exam-scope-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4">
        {showField ? (
          <>
            <label htmlFor="exam-date" className="text-sm text-muted-foreground">
              시험일
            </label>
            <input
              ref={dateRef}
              id="exam-date"
              type="date"
              value={examDate ?? ""}
              onChange={(e) => onChangeDate(e.target.value || undefined)}
              onFocus={() => setEditing(true)}
              onBlur={() => setEditing(false)}
              className="h-9 scroll-mt-24 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-action-400 focus:ring-4 focus:ring-action-50"
            />
            {!examDate && <span className="text-sm text-muted-foreground">정하면 범위 노트의 복습이 시험 전날까지 당겨져요</span>}
          </>
        ) : (
          <>
            <CalendarTile date={examDate} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2.5">
                {countdown && <span className="text-xl font-bold tabular-nums text-foreground">{countdown}</span>}
                <span className={past ? "text-[15px] text-muted-foreground" : "text-[15px] text-foreground"}>
                  {/* The tile is a picture; the date is said here for screen readers. */}
                  <span className="sr-only">{formatDate(examDate)} </span>
                  {weekday(examDate)} 시험{past ? " · 끝났어요" : ""}
                </span>
              </p>
              {rows.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  {/* Each count stays on one line ("일부 확인 2" never splits); lines break before a "·". */}
                  <span className="whitespace-nowrap">범위 노트 {rows.length}개</span>
                  {counts.map((c) => (
                    <span key={c}>
                      {" "}
                      <span className="whitespace-nowrap">· {c}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              시험일 바꾸기
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-1">
        <h2 id="exam-scope-heading" className="text-base font-semibold text-foreground">
          범위 <span className="ml-1 text-sm font-medium text-muted-foreground">{rows.length}</span>
        </h2>
        {rows.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            복습은 각 노트에서 해요{reviewBy ? " · 시험 전날까지 복습이 당겨져요" : ""}
          </p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">시험에 나오는 노트를 넣으면, 노트마다 얼마나 확인했는지 보이고 시험 전에 복습이 와요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {rows.map(({ page, stats, next, pulled, pulledBy, due, state }) => {
            const Icon = noteIcon(page)
            const title = page.title || "제목 없음"
            const { word, dot } = scopeStates[state]
            return (
              <li key={page.id} className="flex items-center gap-1">
                <Link
                  href={due ? reviewHref(page.id) : `/record/${page.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="flex w-[4.75rem] shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
                    {word}
                  </span>
                  <Icon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
                  <span className="hidden w-[4.5rem] shrink-0 tabular-nums text-muted-foreground sm:inline">
                    {stats.understanding !== null ? `이해도 ${stats.understanding}/5` : "기록 없음"}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums sm:w-44">
                    {due ? (
                      <span className="font-semibold text-action-700">{reviewActionLabel(page)}</span>
                    ) : next ? (
                      <span className="text-muted-foreground" title={pulledBy ? `${pulledBy} 전날로 당겨졌어요` : undefined}>
                        <span className="hidden sm:inline">다음 복습 </span>
                        {formatDate(next)}
                        {pulled && <span className="hidden sm:inline">({pulledBy ? "앞 시험" : "시험"} 전날)</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">복습 일정 없음</span>
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onChangeScope(ids.filter((id) => id !== page.id))}
                  aria-label={`${title} 범위에서 빼기`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {rest.length > 0 && (
        <label className="self-start">
          <span className="sr-only">범위에 노트 넣기</span>
          <select
            value=""
            onChange={(e) => e.target.value && onChangeScope([...ids, e.target.value])}
            className="h-8 rounded-lg border border-dashed border-input bg-background px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus:border-action-400"
          >
            <option value="">+ 노트 넣기</option>
            {rest.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title || "제목 없음"}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}

// A desk calendar page: the month on a navy band, the day under it.
function CalendarTile({ date }: { date: string }) {
  const [, m, d] = date.split("-").map(Number)
  return (
    <span aria-hidden="true" className="flex w-14 shrink-0 select-none flex-col overflow-hidden rounded-lg border border-border bg-card text-center">
      <span className="bg-action-600 py-0.5 text-xs font-semibold text-action-foreground">{m}월</span>
      <span className="text-2xl font-extrabold leading-10 tabular-nums text-foreground">{d}</span>
    </span>
  )
}

const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
// From the date alone (no clock, no time zone), so the server and the browser draw the same word.
function weekday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return `${weekdays[new Date(y, m - 1, d).getDay()]}요일`
}
