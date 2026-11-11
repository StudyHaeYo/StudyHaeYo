"use client"

import { useEffect, useRef } from "react"
import { Check } from "lucide-react"
import { useNowMinutes, useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { useStudySession } from "@/lib/study-session"
import { useTimeSlots } from "@/lib/time-slots"
import { addTodo, todayChecklist, todoStartMin, toggleTodo, useTodos, useTodosStatus, type Todo } from "@/lib/todos"
import { usePlans } from "@/lib/plans"
import { activePlans, planToday } from "@/lib/study-stats"
import { layoutLanes, MIN_DRAWN_MINUTES, planRange, rangeLabel } from "@/lib/timetable"
import { TimePicker } from "@/components/time-picker"
import { useWorkspace, type WorkspaceState } from "@/lib/workspace"

// 오늘 시간표 (D-38): the day as a time grid on a navy-tinted panel. A to-do with a time (todos.start_min, and
// duration_min for its length) is a white block from its start to its end — 13:30 to 15:00 is drawn from the middle
// of the 13시 row to the 15시 line. What was actually studied (records with study_records.started_at, and the running
// timer) is a tinted block over the same grid; when the two overlap they sit side by side. A thin line marks now.
// The whole day is one grid in a window about seven hours tall that scrolls, opened at the hour before now, so the
// panel is the same height whenever it is opened. Hidden behind "준비 중" until the columns exist (lib/time-slots.ts).

const DAY_START = 6 // the first hour drawn, unless something is earlier
const HOUR = 40 // px per hour: half an hour still fits one line of text
const WINDOW_HOURS = 7

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

type GridItem = { key: string; start: number; end: number } & ({ kind: "plan"; todo: Todo } | { kind: "study"; title: string })

export function TodayTimetable() {
  const today = useTodayISO()
  const now = useNowMinutes()
  const workspace = useWorkspace()
  const todos = useTodos()
  const todosStatus = useTodosStatus()
  const session = useStudySession()
  const allPlans = usePlans()
  const { todoTimes, recordTimes, todoDurations } = useTimeSlots()

  // Scrolled once, when the grid first shows — not every minute, or it would pull the grid back while someone is
  // looking around.
  const windowRef = useRef<HTMLDivElement>(null)
  const gridReady = today !== null && now !== null && todosStatus !== "loading" && (todoTimes || recordTimes)
  useEffect(() => {
    const el = windowRef.current
    if (gridReady && el) el.scrollTop = Number(el.dataset.open ?? 0)
  }, [gridReady])

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
  const plans: GridItem[] = checklist.flatMap((todo) => {
    const startMin = todoStartMin(todo, today)
    return startMin === null ? [] : [{ kind: "plan" as const, key: todo.id, todo, ...planRange(startMin, todo.durationMin) }]
  })
  const studied: Span[] = [
    ...(recordTimes ? studySpans(workspace, today) : []),
    ...(session.startedAt !== null && sameLocalDay(session.startedAt, today)
      ? [{ key: "running", start: minutesOfDay(session.startedAt), end: Math.max(now, minutesOfDay(session.startedAt) + 1), title: "공부 중" }]
      : []),
  ]
  const studiedMinutes = studied.reduce((sum, s) => sum + (s.end - s.start), 0)
  const items: GridItem[] = [...plans, ...studied.map((s) => ({ kind: "study" as const, ...s }))].sort((a, b) => a.start - b.start)

  // What is drawn: nothing shorter than a line of text. Lanes are worked out on the drawn size, so blocks never cover
  // each other.
  const drawn = items.map((it) => ({ start: it.start, end: Math.min(1440, Math.max(it.end, it.start + MIN_DRAWN_MINUTES)) }))
  const lanes = layoutLanes(drawn)

  const nowHour = Math.floor(now / 60)
  const firstHour = Math.min(DAY_START, nowHour, ...items.map((it) => Math.floor(it.start / 60)))
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i)
  const y = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR
  const openAt = y(Math.max(firstHour, nowHour - 1) * 60)
  const empty = items.length === 0

  // Running plans not on today's checklist yet (a to-do made from a plan starts with the plan's title).
  const fromPlans = todoTimes
    ? activePlans(workspace, allPlans, today).flatMap((item) => {
        const ask = planToday(item)
        return ask && !checklist.some((t) => t.title.startsWith(item.plan.title)) ? [{ id: item.plan.id, ...ask }] : []
      })
    : []

  return (
    <section aria-labelledby="today-timetable-title" className="rounded-xl bg-action-50 p-3">
      {heading(empty ? null : `할 일 ${plans.length}개 · 공부 ${formatDuration(studiedMinutes)}`)}

      <div
        ref={windowRef}
        data-open={openAt}
        tabIndex={0}
        role="group"
        aria-label="시간별 할 일과 공부한 시간"
        className="overflow-y-auto overscroll-contain rounded-md [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        style={{ maxHeight: HOUR * WINDOW_HOURS }}
      >
        <div className="relative" style={{ height: hours.length * HOUR }}>
          {/* the hours: a label and a hairline each */}
          <div aria-hidden="true">
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 flex items-start gap-2" style={{ top: y(h * 60) }}>
                <span className={`w-7 shrink-0 pt-1 text-right text-xs leading-none tabular-nums ${h === nowHour ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {h}시
                </span>
                <span className="h-px flex-1 bg-action-200/70" />
              </div>
            ))}
          </div>

          {/* now: a line across the grid at this minute */}
          <div aria-hidden="true" className="pointer-events-none absolute left-8 right-0 z-10 flex items-center" style={{ top: y(now) - 3 }}>
            <span className="size-[7px] shrink-0 rounded-full bg-foreground" />
            <span className="h-px flex-1 bg-foreground/60" />
          </div>

          <ol className="absolute bottom-0 left-9 right-0 top-0">
            {items.map((it, i) => {
              const top = y(drawn[i].start)
              const height = y(drawn[i].end) - top - 2
              const { lane, lanes: count } = lanes[i]
              const style = { top: top + 1, height, left: `calc(${(lane / count) * 100}% + ${lane > 0 ? 2 : 0}px)`, width: `calc(${100 / count}% - ${lane > 0 ? 2 : 0}px)` }
              const range = rangeLabel(it.start, it.end)
              const twoLines = height >= 36
              // A tall block reads from its top (where it starts); a short one centres its single line.
              const align = height >= 56 ? "justify-start pt-1.5" : "justify-center"
              if (it.kind === "study") {
                return (
                  <li
                    key={it.key}
                    title={`${range} ${it.title}`}
                    className={`absolute flex flex-col overflow-hidden rounded-md border-l-2 border-action-600 bg-action-100 px-1.5 text-action-900 ${align}`}
                    style={style}
                  >
                    <span className="flex min-w-0 items-baseline justify-between gap-1.5 leading-none">
                      <span className="truncate text-xs font-medium">{it.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-action-700">{formatDuration(it.end - it.start)}</span>
                    </span>
                    {twoLines && <span className="mt-1 text-[11px] leading-none tabular-nums text-action-700">{range} 공부함</span>}
                    {!twoLines && <span className="sr-only">{range} 공부함</span>}
                  </li>
                )
              }
              const done = it.todo.doneAt !== null
              return (
                <li
                  key={it.key}
                  title={`${range} ${it.todo.title}`}
                  className={`absolute flex flex-col overflow-hidden rounded-md px-1.5 ring-1 ring-inset ${align} ${
                    done ? "bg-background/60 ring-action-100" : "bg-background ring-action-200"
                  }`}
                  style={style}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`${it.todo.title} ${done ? "완료 취소" : "완료"}`}
                      onClick={() => toggleTodo(it.todo.id)}
                      className={`relative flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-[colors,transform] before:absolute before:-inset-2 active:scale-90 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 ${
                        done ? "border-action-600 bg-action-600 text-action-foreground" : "border-input bg-background hover:border-action-400"
                      }`}
                    >
                      {done && <Check className="size-2.5" aria-hidden="true" />}
                    </button>
                    <span className={`truncate text-[13px] leading-none ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{it.todo.title}</span>
                  </span>
                  {twoLines ? (
                    <span className="mt-1 pl-5 text-[11px] leading-none tabular-nums text-muted-foreground">{range}</span>
                  ) : (
                    <span className="sr-only">{range}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {fromPlans.length > 0 && (
        <div className="mt-3 border-t border-action-100 pt-2">
          <p className="mb-1 px-1 text-xs text-muted-foreground">학습 계획 · 오늘 몫</p>
          <ul>
            {fromPlans.map((p) => (
              <li key={p.id} className="relative flex items-center justify-between gap-2 px-1 py-1">
                <span className="min-w-0 truncate text-sm text-foreground">{p.title}</span>
                <TimePicker
                  startMin={null}
                  durationMin={null}
                  onChange={(start) => start !== null && addTodo(p.title, today, start, p.minutes === null ? null : Math.max(MIN_DRAWN_MINUTES, p.minutes))}
                  withDuration={false}
                  closeOnPick
                  label={`${p.title} 시간표에 넣기`}
                  className={() =>
                    "h-7 rounded-md px-2 text-xs font-medium text-action-700 transition-colors hover:bg-action-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
                  }
                >
                  시간표에 넣기
                </TimePicker>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empty && todoTimes && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
          체크리스트에서 할 일의 시계를 누르면 {todoDurations ? "시각과 길이를 정해" : "그 시각에"} 여기에 넣을 수 있어요.
        </p>
      )}
    </section>
  )
}
