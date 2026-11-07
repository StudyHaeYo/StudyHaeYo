"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, CornerUpLeft, FileQuestion } from "lucide-react"
import { addPageRecord, updatePage, usePagePropsReady, useWorkspace } from "@/lib/workspace"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"
import { useTodayISO } from "@/hooks/use-today"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { examDeadlines, reviewCandidates } from "@/lib/study-candidates"
import {
  blocksPlainText,
  computePageStats,
  formatDate,
  isTextBlock,
  newBlockId,
  newRecordId,
  nextReviewDate,
  pageKind,
  understandingLabel,
  understandingLevels,
  type StudyPage,
} from "@/lib/study-pages"
import { reviewOffsetDays } from "@/lib/learning-os"
import {
  cueSummary,
  itemTypeInfo,
  reviewExplanation,
  reviewItems,
  reviewRecordText,
  reviewUnderstanding,
  type JudgedItem,
  type Judgment,
  type ReviewCue,
  type ReviewItem,
} from "@/lib/review"

// 복습 화면 (D-34). `pageId`: one note (from the note's top bar or 홈's list). Without it: every note due today, one
// after another (오늘 복습). Desktop first, inside the app with the sidebar (Notion structure); a phone gets the same
// screen narrower.

type Phase = "intro" | "item" | "noteDone" | "final" | "stopped"

interface NoteRun {
  pageId: string
  title: string
  before: number | null
  cue: ReviewCue
  items: ReviewItem[]
  // cue "none": the note as text, to read before picking 이해도.
  bodyText: string
  startedAt: number
}

interface NoteResult {
  pageId: string
  title: string
  before: number | null
  after: number
  cue: ReviewCue
  rows: JudgedItem[]
  recordId: string
  // 오답 노트 problems as they were, put back by [되돌리기].
  prevProblems: { id: string; result?: "right" | "wrong"; triedOn?: string }[]
}

const isDueToday = (tone: string) => tone === "overdue" || tone === "today"

function buildRun(page: StudyPage, today: string, problemsOn: boolean): NoteRun {
  const { cue, items } = reviewItems(page, problemsOn && pageKind(page) === "wrong-answers")
  return {
    pageId: page.id,
    title: page.title.trim() || "제목 없음",
    before: computePageStats(page, today).understanding,
    cue,
    items,
    bodyText: blocksPlainText(page.blocks).trim(),
    startedAt: Date.now(),
  }
}

export function ReviewScreen({ pageId }: { pageId?: string }) {
  const workspace = useWorkspace()
  const dataStatus = useDataStatus()
  const today = useTodayISO()
  const problemsOn = usePagePropsReady()

  // The notes to go through, fixed when the screen opens: a reviewed note stops being due, and the list must not
  // shift under the user.
  const [queue, setQueue] = useState<string[] | null>(null)
  const [phase, setPhase] = useState<Phase>("intro")
  const [ni, setNi] = useState(0)
  const [run, setRun] = useState<NoteRun | null>(null)
  const [ii, setIi] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [rows, setRows] = useState<JudgedItem[]>([])
  const [result, setResult] = useState<NoteResult | null>(null)
  const [done, setDone] = useState<NoteResult[]>([])
  const [stopOpen, setStopOpen] = useState(false)

  const promptRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)

  const ready = today !== null && dataStatus.phase === "ready"

  useEffect(() => {
    if (queue !== null || !ready || !today) return
    if (pageId) {
      const page = workspace.pages.find((p) => p.id === pageId)
      setQueue(page ? [page.id] : [])
      if (page) {
        setRun(buildRun(page, today, problemsOn))
        setPhase("item")
      }
      return
    }
    setQueue(reviewCandidates(workspace, today).filter((c) => isDueToday(c.dueTone)).map((c) => c.pageId))
  }, [queue, ready, today, pageId, workspace, problemsOn])

  // Focus follows the step: the prompt of each item, the answer once opened, the heading of a finished note.
  useEffect(() => {
    if (phase === "item") promptRef.current?.focus()
    if (phase === "noteDone") doneRef.current?.focus()
  }, [phase, ii, run?.pageId])
  useEffect(() => {
    if (revealed) answerRef.current?.focus()
  }, [revealed])

  const pageOf = (id: string) => workspace.pages.find((p) => p.id === id)

  const startNote = (index: number) => {
    if (!queue || !today) return
    // A note deleted meanwhile is skipped.
    let i = index
    while (i < queue.length && !pageOf(queue[i])) i++
    if (i >= queue.length) {
      setPhase("final")
      return
    }
    setNi(i)
    setRun(buildRun(pageOf(queue[i])!, today, problemsOn))
    setIi(0)
    setRevealed(false)
    setDrafts({})
    setRows([])
    setResult(null)
    setPhase("item")
  }

  // One record per note, saved as soon as the note is done (so leaving the screen keeps it).
  const finish = (judged: JudgedItem[], after: number) => {
    if (!run || !today) return
    const page = pageOf(run.pageId)
    if (!page) return
    const problemRows = judged.filter((r) => r.item.type === "problem")
    const prevProblems = problemRows.map((r) => {
      const block = page.blocks.find((b) => b.id === r.item.blockId)
      return block && isTextBlock(block) ? { id: block.id, result: block.result, triedOn: block.triedOn } : { id: r.item.blockId }
    })
    if (problemRows.length > 0)
      updatePage(page.id, (p) => ({
        ...p,
        blocks: p.blocks.map((b) => {
          const row = problemRows.find((r) => r.item.blockId === b.id)
          return row && isTextBlock(b) ? { ...b, result: row.judgment === "right" ? ("right" as const) : ("wrong" as const), triedOn: today } : b
        }),
      }))
    const recordId = newRecordId()
    addPageRecord(page.id, {
      id: recordId,
      pageId: page.id,
      date: today,
      createdAt: Date.now(),
      durationMinutes: Math.max(1, Math.round((Date.now() - run.startedAt) / 60_000)),
      understanding: after,
      ...reviewRecordText(judged, run.cue),
      nextSteps: "",
      tags: [],
    })
    const noteResult: NoteResult = { pageId: page.id, title: run.title, before: run.before, after, cue: run.cue, rows: judged, recordId, prevProblems }
    setRows(judged)
    setResult(noteResult)
    setDone((d) => [...d, noteResult])
    setRevealed(false)
    setPhase("noteDone")
  }

  const judge = (judgment: Judgment) => {
    if (!run || phase !== "item" || !revealed) return
    const item = run.items[ii]
    const judged = [...rows, { item, judgment, written: (drafts[ii] ?? "").trim().length > 0 }]
    if (ii + 1 < run.items.length) {
      setRows(judged)
      setIi(ii + 1)
      setRevealed(false)
      return
    }
    finish(judged, reviewUnderstanding(judged))
  }

  // [되돌리기]: the last judgment. On a finished note it also takes back the record and the problem marks.
  const undo = () => {
    if (!run) return
    if (phase === "item" && ii > 0) {
      setRows(rows.slice(0, -1))
      setIi(ii - 1)
      setRevealed(true)
      return
    }
    if (phase !== "noteDone" || !result) return
    updatePage(result.pageId, (p) => ({
      ...p,
      studyRecords: p.studyRecords.filter((r) => r.id !== result.recordId),
      blocks: p.blocks.map((b) => {
        const prev = result.prevProblems.find((x) => x.id === b.id)
        if (!prev || !isTextBlock(b)) return b
        const { result: _r, triedOn: _t, ...rest } = b
        return { ...rest, ...(prev.result ? { result: prev.result } : {}), ...(prev.triedOn ? { triedOn: prev.triedOn } : {}) }
      }),
    }))
    setDone((d) => d.filter((x) => x.recordId !== result.recordId))
    setResult(null)
    if (run.cue !== "none") {
      setRows(result.rows.slice(0, -1))
      setIi(run.items.length - 1)
      setRevealed(true)
    }
    setPhase("item")
  }

  const next = () => {
    if (queue && ni + 1 < queue.length) startNote(ni + 1)
    else setPhase("final")
  }

  // Space opens the answer, 1 · 2 · 3 judge it. Typing in the answer box is left alone (Ctrl/⌘+Enter opens).
  useEffect(() => {
    if (phase !== "item" || !run || run.cue === "none" || stopOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)
      if (typing) {
        if (!revealed && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          setRevealed(true)
        }
        return
      }
      if (e.ctrlKey || e.metaKey) return
      if (!revealed && e.key === " ") {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault()
        judge(e.key === "1" ? "wrong" : e.key === "2" ? "unsure" : "right")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!ready || !today || queue === null) {
    return dataStatus.phase === "error" ? <DataStatusView status={dataStatus} /> : <DataStatusView status={{ phase: "loading" }} />
  }

  const continuous = !pageId
  const others = reviewCandidates(workspace, today).filter((c) => isDueToday(c.dueTone) && c.pageId !== pageId)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
        <nav aria-label="위치" className="flex min-w-0 items-center gap-1.5 text-sm">
          {continuous ? (
            <Link href="/review" className="shrink-0 text-muted-foreground hover:text-foreground">
              오늘 복습
            </Link>
          ) : (
            <span className="shrink-0 text-muted-foreground">복습</span>
          )}
          {run && (phase === "item" || phase === "noteDone") && (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                /
              </span>
              <span className="truncate font-medium text-foreground">{run.title}</span>
            </>
          )}
        </nav>
        {run && (phase === "item" || phase === "noteDone") && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {continuous && queue.length > 1 && `노트 ${ni + 1}/${queue.length} · `}
              {phase === "noteDone" ? "끝" : run.cue === "none" ? "이해도 고르기" : `문항 ${ii + 1}/${run.items.length}`}
            </span>
            {(phase === "item" || (continuous && ni + 1 < queue.length)) && (
              <button
                type="button"
                onClick={() => setStopOpen(true)}
                className="rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                멈추기
              </button>
            )}
          </div>
        )}
      </header>
      {run && phase === "item" && run.cue !== "none" && (
        <div className="h-0.5 bg-muted" aria-hidden="true">
          <div
            className="h-full origin-left bg-action-600 transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `scaleX(${ii / run.items.length})` }}
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-6 pb-24 pt-12 lg:pt-16">
        {phase === "intro" && continuous && (
          <Intro queue={queue.map(pageOf).filter((p) => p !== undefined)} problemsOn={problemsOn} onStart={() => startNote(0)} />
        )}
        {pageId && queue.length === 0 && <MissingNote />}

        {phase === "item" && run && run.cue === "none" && (
          <PickUnderstanding run={run} onPick={(value) => finish([], value)} />
        )}

        {phase === "item" && run && run.cue !== "none" && (
          <ItemView
            item={run.items[ii]}
            draft={drafts[ii] ?? ""}
            onDraft={(value) => setDrafts((d) => ({ ...d, [ii]: value }))}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onJudge={judge}
            canUndo={ii > 0}
            onUndo={undo}
            promptRef={promptRef}
            answerRef={answerRef}
          />
        )}

        {phase === "noteDone" && result && run && (
          <NoteDone
            result={result}
            today={today}
            examPull={examDeadlines(workspace, today).get(result.pageId)?.reviewBy ?? null}
            headingRef={doneRef}
            onUndo={undo}
            actions={
              continuous ? (
                <button type="button" onClick={next} className={primary}>
                  {queue && ni + 1 < queue.length ? `다음 노트: ${pageOf(queue[ni + 1])?.title.trim() || "제목 없음"}` : "오늘 복습 마치기"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              ) : (
                <>
                  <Link href={`/record/${result.pageId}`} className={primary}>
                    노트로 돌아가기
                  </Link>
                  {others.length > 0 && (
                    <Link href="/review" className={secondary}>
                      오늘 복습할 노트 {others.length}개 더 하기
                    </Link>
                  )}
                </>
              )
            }
          />
        )}

        {(phase === "final" || phase === "stopped") && (
          <Summary stopped={phase === "stopped"} done={done} left={queue.length - done.length} continuous={continuous} />
        )}

      </div>

      {stopOpen && run && (
        <StopDialog
          text={
            phase === "noteDone"
              ? "이 노트까지 기록했어요."
              : run.cue === "none"
                ? "이해도를 고르지 않아서 이 노트는 기록하지 않아요."
                : rows.length === 0
                  ? "이 노트는 아직 푼 문항이 없어서 기록하지 않아요."
                  : `이 노트는 ${run.items.length}문항 중 ${rows.length}개를 풀었어요. 다 풀어야 이해도가 정해져서, 멈추면 이 노트는 기록하지 않고 다음 복습에 처음부터 다시 나와요.`
          }
          remain={
            continuous && queue.length - ni - (phase === "noteDone" ? 1 : 0) > 0
              ? `남은 노트 ${queue.length - ni - (phase === "noteDone" ? 1 : 0)}개는 다음에 이어서 할 수 있어요.`
              : ""
          }
          onCancel={() => setStopOpen(false)}
          onStop={() => {
            setStopOpen(false)
            setPhase("stopped")
          }}
        />
      )}
    </div>
  )
}

const primary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-action-600 px-4 text-sm font-semibold text-action-foreground transition-[background-color,transform] duration-150 hover:bg-action-700 active:scale-[0.97] motion-reduce:active:scale-100"
const secondary =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.97] motion-reduce:active:scale-100"

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd aria-hidden="true" className="hidden rounded border border-current/30 px-1.5 font-sans text-[11px] font-medium opacity-70 [@media(hover:hover)]:inline">
      {children}
    </kbd>
  )
}

function Intro({ queue, problemsOn, onStart }: { queue: StudyPage[]; problemsOn: boolean; onStart: () => void }) {
  const notes = queue.map((page) => ({ page, ...reviewItems(page, problemsOn && pageKind(page) === "wrong-answers") }))
  const startRef = useRef<HTMLButtonElement>(null)
  useEffect(() => startRef.current?.focus(), [])
  if (notes.length === 0) {
    return (
      <section aria-labelledby="review-title" className="flex flex-col gap-3">
        <h1 id="review-title" className="text-2xl font-semibold tracking-tight text-foreground">
          오늘 복습
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">오늘 복습할 노트가 없어요. 공부한 노트는 다시 볼 때가 되면 여기에 나와요.</p>
        <Link href="/" className={`${secondary} mt-3 self-start`}>
          홈으로
        </Link>
      </section>
    )
  }
  const itemCount = notes.reduce((n, x) => n + x.items.length, 0)
  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 id="review-title" className="text-2xl font-semibold tracking-tight text-foreground">
          오늘 복습
        </h1>
        <p className="text-sm text-muted-foreground">
          노트 {notes.length}개{itemCount > 0 ? ` · 문항 ${itemCount}개` : ""}
        </p>
      </div>
      <ol className="divide-y divide-border border-y border-border">
        {notes.map(({ page, cue, items }) => (
          <li key={page.id} className="flex items-baseline justify-between gap-4 py-3">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{page.title.trim() || "제목 없음"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{cueSummary(cue, items)}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        <p>문항은 하 → 중 → 상 순서로 나와요. 하는 용어와 정의, 중은 예제에 적용, 상은 비교하고 이유 설명이에요.</p>
        <p>중 · 상 문항은 답을 한 단어라도 써 보고 맞혀야 이해도 4 · 5까지 올라요. 노트를 다 풀 때마다 학습 기록이 하나씩 남아요.</p>
      </div>
      <button ref={startRef} type="button" onClick={onStart} className={`${primary} self-start`}>
        시작하기
      </button>
    </section>
  )
}

function ItemView({
  item,
  draft,
  onDraft,
  revealed,
  onReveal,
  onJudge,
  canUndo,
  onUndo,
  promptRef,
  answerRef,
}: {
  item: ReviewItem
  draft: string
  onDraft: (value: string) => void
  revealed: boolean
  onReveal: () => void
  onJudge: (judgment: Judgment) => void
  canUndo: boolean
  onUndo: () => void
  promptRef: React.RefObject<HTMLHeadingElement | null>
  answerRef: React.RefObject<HTMLDivElement | null>
}) {
  const info = itemTypeInfo[item.type]
  // 하 is recalled; 중 · 상 can be written, and only a written answer counts toward 4 · 5 (D-32).
  const writable = item.level !== "하"
  return (
    <section aria-labelledby="item-prompt" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="self-start rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {item.type === "heading" ? "소제목 떠올리기" : `${info.label} · ${item.level}`}
        </span>
        <h1
          id="item-prompt"
          ref={promptRef}
          tabIndex={-1}
          className="whitespace-pre-line text-pretty text-2xl font-semibold leading-snug tracking-tight text-foreground outline-none"
        >
          {item.prompt}
        </h1>
        <p className="text-sm text-muted-foreground">{info.hint}</p>
      </div>

      {writable && !revealed && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-draft" className="text-sm font-medium text-foreground">
            답 써 보기 <span className="font-normal text-muted-foreground">(선택)</span>
          </label>
          <textarea
            id="review-draft"
            name="review-draft"
            rows={3}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            autoComplete="off"
            placeholder="떠오르는 대로 써 보세요…"
            className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-action-500 focus-visible:ring-2 focus-visible:ring-action-200"
          />
          <p className="text-xs text-muted-foreground">한 단어라도 써 보고 맞히면 이해도 4 · 5까지 올라가요. 안 써도 돼요.</p>
        </div>
      )}

      {!revealed ? (
        <button type="button" onClick={onReveal} aria-keyshortcuts="Space" className={`${secondary} self-start gap-2`}>
          떠올렸으면 펼치기
          <Kbd>Space</Kbd>
        </button>
      ) : (
        <div className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150">
          <div ref={answerRef} tabIndex={-1} className="flex flex-col gap-3 outline-none">
            <div className="rounded-lg bg-muted/60 px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">{info.answerLabel}</p>
              <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{item.answer}</p>
            </div>
            {draft.trim() && (
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">내가 쓴 답</p>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{draft.trim()}</p>
              </div>
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">떠올린 것과 맞춰 보고 골라 주세요</legend>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onJudge("wrong")}
                aria-keyshortcuts="1"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-danger-200 bg-card text-sm font-semibold text-danger-700 transition-[background-color,transform] duration-150 hover:bg-danger-50 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                틀림 <Kbd>1</Kbd>
              </button>
              <button
                type="button"
                onClick={() => onJudge("unsure")}
                aria-keyshortcuts="2"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-attention-300 bg-card text-sm font-semibold text-attention-800 transition-[background-color,transform] duration-150 hover:bg-attention-50 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                헷갈림 <Kbd>2</Kbd>
              </button>
              <button
                type="button"
                onClick={() => onJudge("right")}
                aria-keyshortcuts="3"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-action-600 text-sm font-semibold text-action-foreground transition-[background-color,transform] duration-150 hover:bg-action-700 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                맞음 <Kbd>3</Kbd>
              </button>
            </div>
          </fieldset>
        </div>
      )}

      {canUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <CornerUpLeft className="size-3.5" aria-hidden="true" />
          앞 문항 판정 되돌리기
        </button>
      )}
    </section>
  )
}

// No 핵심 개념 · problems · headings to recall from: read the note and pick 1–5 once.
function PickUnderstanding({ run, onPick }: { run: NoteRun; onPick: (value: number) => void }) {
  return (
    <section aria-labelledby="pick-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="pick-title" className="text-2xl font-semibold tracking-tight text-foreground">
          {run.title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          이 노트에는 떠올릴 단서(핵심 개념 · 소제목)가 없어요. 노트를 다시 읽고 지금 이해도를 골라 주세요.
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg bg-muted/60 px-4 py-3.5">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">{run.bodyText || "노트가 비어 있어요."}</p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">지금 이해도</legend>
        <div className="grid grid-cols-5 gap-2">
          {understandingLevels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(i + 1)}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-2.5 text-sm transition-[background-color,border-color,transform] duration-150 hover:border-action-300 hover:bg-accent active:scale-[0.97] motion-reduce:active:scale-100"
            >
              <span className="font-semibold text-foreground">{i + 1}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  )
}

function NoteDone({
  result,
  today,
  examPull,
  headingRef,
  onUndo,
  actions,
}: {
  result: NoteResult
  today: string
  examPull: string | null
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onUndo: () => void
  actions: React.ReactNode
}) {
  const { rows, cue, after, before } = result
  const { reasons, hint } = cue === "none" ? { reasons: ["직접 고른 이해도예요"], hint: "" } : reviewExplanation(rows, cue, after)
  const problemRows = rows.filter((r) => r.item.type === "problem")
  const rightProblems = problemRows.filter((r) => r.judgment === "right").length
  const solved = problemRows.length > 0 && rightProblems === problemRows.length
  const planned = nextReviewDate(today, after)
  const pulled = examPull !== null && examPull > today && planned > examPull
  const missed = rows.filter((r) => r.judgment !== "right")
  const change = before === null ? "처음 기록이에요" : after > before ? "올랐어요" : after < before ? "내려갔어요" : "그대로예요"

  return (
    <section aria-labelledby="done-title" className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 id="done-title" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
          복습을 마쳤어요
        </h1>
        <p className="text-sm text-muted-foreground">기록 1개를 남겼어요.</p>
      </div>

      <div className="flex flex-col gap-1 border-y border-border py-5">
        <p className="text-xs font-medium text-muted-foreground">{cue === "none" ? "이해도" : "이번 복습에서 확인한 단계"}</p>
        <p className="text-xl font-semibold tabular-nums text-foreground">
          {before === null ? "–" : before} → {after} · {understandingLabel(after)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{change}</span>
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {hint && <p className="mt-2 text-sm leading-relaxed text-foreground">{hint}</p>}
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <p className="font-medium text-foreground">
          {solved
            ? "모든 문제를 맞혀서 이 오답 노트는 다시 풀 문제가 없어요."
            : pulled
              ? `다음 복습: ${formatDate(examPull!)} (시험 전날로 당김)`
              : `다음 복습: ${formatDate(planned)} (${reviewOffsetDays[after] ?? 4}일 뒤 · 이해도 ${after})`}
        </p>
        {problemRows.length > 0 && !solved && (
          <p className="text-muted-foreground">
            {rightProblems > 0 && `맞힌 문제 ${rightProblems}개는 다음 복습부터 빠지고, `}
            {`못 맞힌 문제 ${problemRows.length - rightProblems}개는 오답 노트에 남아 다음 복습에 다시 나와요.`}
          </p>
        )}
      </div>

      {missed.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">다시 볼 곳</h2>
          <ul className="divide-y divide-border border-y border-border">
            {missed.map((r) => (
              <li key={r.item.blockId} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{r.item.prompt}</span>
                  <span className={`text-xs ${r.judgment === "wrong" ? "text-danger-700" : "text-attention-700"}`}>
                    {r.judgment === "wrong" ? "틀림" : "헷갈림"} · {itemTypeInfo[r.item.type].label}
                  </span>
                </span>
                <Link
                  href={`/record/${result.pageId}?block=${encodeURIComponent(r.item.blockId)}`}
                  className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-action-700 hover:bg-accent"
                >
                  노트에서 보기
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cue !== "items" && <WriteConcept pageId={result.pageId} />}

      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground hover:text-foreground"
      >
        <CornerUpLeft className="size-3.5" aria-hidden="true" />
        {cue === "none" ? "이해도 다시 고르기" : "마지막 판정 되돌리기"}
      </button>
    </section>
  )
}

// A note reviewed without cards can get one now, so the next review has something to recall (optional).
function WriteConcept({ pageId }: { pageId: string }) {
  const [state, setState] = useState<"idle" | "editing" | "saved">("idle")
  const [text, setText] = useState("")
  if (state === "saved") return <p className="text-sm text-muted-foreground">노트 끝에 핵심 개념을 넣었어요. 다음 복습부터 카드로 확인해요.</p>
  if (state === "idle")
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-muted/60 px-4 py-3.5">
        <p className="text-sm leading-relaxed text-foreground">
          핵심 개념을 하나 써 두면 다음 복습부터 카드로 확인할 수 있어요. 안 써도 돼요.
        </p>
        <button type="button" onClick={() => setState("editing")} className={`${secondary} h-9 self-start`}>
          핵심 개념 쓰기
        </button>
      </div>
    )
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-muted/60 px-4 py-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        updatePage(pageId, (p) => ({ ...p, blocks: [...p.blocks, { id: newBlockId(), type: "concept", text: text.trim() }] }))
        setState("saved")
      }}
    >
      <label htmlFor="new-concept" className="text-sm font-medium text-foreground">
        핵심 개념 <span className="font-normal text-muted-foreground">“용어: 설명”으로 쓰면 앞면과 뒷면이 돼요</span>
      </label>
      <input
        id="new-concept"
        name="new-concept"
        autoComplete="off"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="용어: 설명…"
        className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-action-500 focus-visible:ring-2 focus-visible:ring-action-200"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={!text.trim()} className={`${primary} h-9 disabled:cursor-not-allowed disabled:opacity-50`}>
          노트에 넣기
        </button>
        <button type="button" onClick={() => setState("idle")} className={`${secondary} h-9`}>
          취소
        </button>
      </div>
    </form>
  )
}

function Summary({ stopped, done, left, continuous }: { stopped: boolean; done: NoteResult[]; left: number; continuous: boolean }) {
  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 id="summary-title" className="text-2xl font-semibold tracking-tight text-foreground">
          {stopped ? "여기서 멈췄어요" : "오늘 복습 끝"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {done.length > 0 ? `노트 ${done.length}개 · 기록 ${done.length}개(노트마다 하나)` : "남긴 기록은 없어요."}
          {stopped && continuous && left > 0 ? ` 남은 노트 ${left}개는 다음에 이어서 할 수 있어요.` : ""}
        </p>
      </div>
      {done.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {done.map((r) => (
            <li key={r.recordId} className="flex items-baseline justify-between gap-4 py-3">
              <Link href={`/record/${r.pageId}`} className="min-w-0 truncate text-sm font-medium text-foreground hover:underline">
                {r.title}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                이해도 {r.before === null ? "–" : r.before} → {r.after} · {understandingLabel(r.after)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/" className={`${primary} self-start`}>
        홈으로
      </Link>
    </section>
  )
}

function MissingNote() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-base font-medium text-foreground">노트를 찾을 수 없어요</h1>
      <p className="mt-1 text-sm text-muted-foreground">삭제되었거나 존재하지 않는 노트예요.</p>
      <Link href="/" className={`${primary} mt-5`}>
        홈으로
      </Link>
    </div>
  )
}

function StopDialog({ text, remain, onCancel, onStop }: { text: string; remain: string; onCancel: () => void; onStop: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef(onCancel)
  useFocusTrap(dialogRef, true)
  useEffect(() => {
    cancelRef.current = onCancel
  })
  // Focus the safe choice once when it opens; Escape closes.
  useEffect(() => {
    keepRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stop-title"
        aria-describedby="stop-desc"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 id="stop-title" className="text-base font-semibold text-foreground">
          복습을 멈출까요?
        </h2>
        <p id="stop-desc" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {text} {remain}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={keepRef} type="button" onClick={onCancel} className={secondary}>
            계속하기
          </button>
          <button type="button" onClick={onStop} className={primary}>
            멈추기
          </button>
        </div>
      </div>
    </div>
  )
}
