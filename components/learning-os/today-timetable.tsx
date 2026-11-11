"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { useNowMinutes, useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { useStudySession } from "@/lib/study-session"
import { useTimeSlots } from "@/lib/time-slots"
import { addTodo, todayChecklist, todoStartMin, toggleTodo, useTodos, useTodosStatus } from "@/lib/todos"
import { usePlans } from "@/lib/plans"
import { activePlans, planToday } from "@/lib/study-stats"
import { HourPicker } from "@/components/hour-picker"
import { useWorkspace, type WorkspaceState } from "@/lib/workspace"

// 오늘 시간표 (D-38): one row per hour on a navy-tinted panel. The text of a row is the plan — to-dos with a time
// (todos.start_min). The rail beside the hour labels is what actually happened — records with a start time
// (study_records.started_at) and the running timer session, filled to the minute. Hours before now fold into one
// line so the panel stays short. Hidden behind "준비 중" until the columns exist (lib/time-slots.ts).

const DAY_START = 6 // the first row, unless something is earlier
const ROW = 32 // px

// Minutes of today: [start, end)
type Span = { key: string; start: number; end: number; title: string }

function minutesOfDay(ms: number) {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

function sameLocalDay(ms: number, today: string) {
  const d = new Date(ms)
  return today === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Today's records that know when they started. A record running past midnight is cut at 24:00.
function studySpans(workspace: WorkspaceState, today: string): Span[] {
  const spans: Span[] = []
  const add = (id: string, startedAt: number | undefined, minutes: number, title: string) => {
    if (typeof startedAt !== "number" || minutes <= 0 || !sameLocalDay(startedAt, today)) return
    const start = minutesOfDay(startedAt)
    spans.push({ key: id, start, end: Math.min(1440, start + minutes), title })
  }
  for (const page of workspace.pages) {
    for (const r of page.studyRecords) add(r.id, r.startedAt, r.durationMinutes, page.title || "제목 없음")
  }
  for (const r of workspace.subjectRecords) {
    const subject = workspace.groups.find((g) => g.id === r.subjectId)?.name
    add(r.id, r.startedAt, r.durationMinutes, r.studyContent || subject || "노트 없이 공부")
  }
  return spans.sort((a, b) => a.start - b.start)
}

export function TodayTimetable() {
  const today = useTodayISO()
  const now = useNowMinutes()
  const workspace = useWorkspace()
  const todos = useTodos()
  const todosStatus = useTodosStatus()
  const session = useStudySession()
  const allPlans = usePlans()
  const { todoTimes, recordTimes } = useTimeSlots()
  const [earlier, setEarlier] = useState(false)

  const heading = (aside: string | null) => (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 id="today-timetable-title" className="text-base font-semibold text-foreground">
        오늘 시간표
      </h2>
      {aside && <p className="text-xs text-muted-foreground">{aside}</p>}
    </div>
  )

  if (today === null || now === null || todosStatus === "loading") {
    return <div className="h-72 animate-pulse rounded-xl bg-action-50" aria-hidden="true" />
  }
  // Neither column yet: nothing to draw. (With only one, the half that exists still shows.)
  if (!todoTimes && !recordTimes) {
    return (
      <section aria-labelledby="today-timetable-title" className="rounded-xl bg-action-50 p-3">
        {heading("준비 중")}
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">시간표를 저장할 곳을 준비하고 있어요.</p>
      </section>
    )
  }

  const checklist = todayChecklist(todos, today)
  const plans = checklist.flatMap((todo) => {
    const startMin = todoStartMin(todo, today)
    return startMin === null ? [] : [{ todo, hour: Math.floor(startMin / 60) }]
  })
  const untimed = checklist.filter((t) => t.doneAt === null && todoStartMin(t, today) === null).length

  const studies = recordTimes ? studySpans(workspace, today) : []
  const running: Span[] =
    session.startedAt !== null && sameLocalDay(session.startedAt, today)
      ? [{ key: "running", start: minutesOfDay(session.startedAt), end: Math.max(now, minutesOfDay(session.startedAt) + 1), title: "공부 중" }]
      : []
  const spans = [...studies, ...running]
  const studied = spans.reduce((sum, s) => sum + (s.end - s.start), 0)

  const nowHour = Math.floor(now / 60)
  const firstHour = Math.min(DAY_START, nowHour, ...plans.map((p) => p.hour), ...spans.map((s) => Math.floor(s.start / 60)))
  const foldUntil = nowHour - 1 // rows before this hour fold away
  const canFold = foldUntil > firstHour
  const from = earlier || !canFold ? firstHour : foldUntil
  const hours = Array.from({ length: 24 - from }, (_, i) => from + i)

  const foldedPlans = plans.filter((p) => p.hour < foldUntil)
  const foldedStudied = spans.reduce((sum, s) => sum + Math.max(0, Math.min(s.end, foldUntil * 60) - s.start), 0)
  const empty = plans.length === 0 && spans.length === 0
  // Running plans not on today's checklist yet (a to-do made from a plan starts with the plan's title).
  const fromPlans = todoTimes
    ? activePlans(workspace, allPlans, today).flatMap((item) => {
        const ask = planToday(item)
        return ask && !checklist.some((t) => t.title.startsWith(item.plan.title)) ? [{ id: item.plan.id, ...ask }] : []
      })
    : []

  return (
    <section aria-labelledby="today-timetable-title" className="rounded-xl bg-action-50 p-3">
      {heading(empty ? null : `계획 ${plans.length}개 · 공부 ${formatDuration(studied)}`)}

      {canFold && (
        <button
          type="button"
          onClick={() => setEarlier((v) => !v)}
          aria-expanded={earlier}
          className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-action-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        >
          <span className="truncate">
            {firstHour}시~{foldUntil}시
            {foldedPlans.length > 0 && ` · 계획 ${foldedPlans.length}개 중 ${foldedPlans.filter((p) => p.todo.doneAt !== null).length}개 완료`}
            {foldedStudied > 0 && ` · 공부 ${formatDuration(foldedStudied)}`}
          </span>
          <ChevronDown className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${earlier ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      <ol>
        {hours.map((h) => {
          const rowPlans = plans.filter((p) => p.hour === h)
          const inHour = spans.filter((s) => s.start < (h + 1) * 60 && s.end > h * 60)
          const startsHere = spans.filter((s) => Math.floor(s.start / 60) === h)
          const current = h === nowHour
          return (
            <li key={h} aria-current={current ? "time" : undefined} className="flex items-stretch gap-2" style={{ minHeight: ROW }}>
              <span className={`w-7 shrink-0 pt-1.5 text-right text-xs tabular-nums ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {h}시
              </span>

              {/* the rail: the studied minutes of this hour, and where now is */}
              <span className="relative w-[3px] shrink-0 bg-action-200/70" aria-hidden="true">
                {inHour.map((s) => {
                  const top = Math.max(0, s.start / 60 - h)
                  const bottom = Math.min(1, s.end / 60 - h)
                  return <span key={s.key} className="absolute inset-x-0 bg-action-600" style={{ top: `${top * 100}%`, height: `${(bottom - top) * 100}%` }} />
                })}
                {current && (
                  <span
                    className="absolute left-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-action-50 bg-foreground"
                    style={{ top: `${(now / 60 - h) * 100}%` }}
                  />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-b border-action-100 py-1">
                {rowPlans.map(({ todo }) => {
                  const done = todo.doneAt !== null
                  return (
                    <span key={todo.id} className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`${todo.title} ${done ? "완료 취소" : "완료"}`}
                        onClick={() => toggleTodo(todo.id)}
                        className={`relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-[colors,transform] before:absolute before:-inset-2 active:scale-90 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 ${
                          done ? "border-action-600 bg-action-600 text-action-foreground" : "border-input bg-background hover:border-action-400"
                        }`}
                      >
                        {done && <Check className="size-3" aria-hidden="true" />}
                      </button>
                      <span className={`truncate text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{todo.title}</span>
                    </span>
                  )
                })}
                {startsHere.map((s) => (
                  <span key={s.key} className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-action-700">{s.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(s.end - s.start)}</span>
                  </span>
                ))}
              </span>
            </li>
          )
        })}
      </ol>

      {fromPlans.length > 0 && (
        <div className="mt-3 border-t border-action-100 pt-2">
          <p className="mb-1 px-1 text-xs text-muted-foreground">진행 중인 계획에서 오늘 할 만큼</p>
          <ul>
            {fromPlans.map((p) => (
              <li key={p.id} className="relative flex items-center justify-between gap-2 px-1 py-1">
                <span className="min-w-0 truncate text-sm text-foreground">{p.title}</span>
                <HourPicker
                  hour={null}
                  onPick={(h) => h !== null && addTodo(p.title, today, h * 60)}
                  label={`${p.title} 시간표에 넣기`}
                  className={() =>
                    "h-7 rounded-md px-2 text-xs font-medium text-action-700 transition-colors hover:bg-action-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
                  }
                >
                  시간표에 넣기
                </HourPicker>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(empty || untimed > 0) && todoTimes && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
          {untimed > 0 ? `시각을 정하지 않은 할 일 ${untimed}개 · ` : ""}
          체크리스트에서 할 일의 시계를 누르면 시각을 정할 수 있어요.
        </p>
      )}
    </section>
  )
}
