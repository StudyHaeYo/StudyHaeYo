"use client"

import { useEffect, useRef } from "react"
import { Check } from "lucide-react"
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
// (study_records.started_at) and the running timer session, filled to the minute. An hour that holds something is a
// white block; empty hours are open space (no grid lines). The whole day is one list in a window about eight hours
// tall that scrolls, opened at the hour before now, so the panel is the same height at 7 in the morning and at 10 at
// night. Hidden behind "준비 중" until the columns exist (lib/time-slots.ts).

const DAY_START = 6 // the first row, unless something is earlier
const ROW = 34 // px
const VISIBLE_ROWS = 8 // the window shows about this many hours; the rest scrolls

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
  // The day is one list in a short window that scrolls; it opens with the hour before now at the top. Scrolled once,
  // when the list first shows — not every minute, or it would pull the list back while someone is looking around.
  const listRef = useRef<HTMLOListElement>(null)
  const listReady = today !== null && now !== null && todosStatus !== "loading" && (todoTimes || recordTimes)
  useEffect(() => {
    const list = listRef.current
    if (!listReady || !list) return
    const row = list.querySelector<HTMLElement>("[data-start]")
    if (row) list.scrollTop = row.offsetTop
  }, [listReady])

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

  const studies = recordTimes ? studySpans(workspace, today) : []
  const running: Span[] =
    session.startedAt !== null && sameLocalDay(session.startedAt, today)
      ? [{ key: "running", start: minutesOfDay(session.startedAt), end: Math.max(now, minutesOfDay(session.startedAt) + 1), title: "공부 중" }]
      : []
  const spans = [...studies, ...running]
  const studied = spans.reduce((sum, s) => sum + (s.end - s.start), 0)

  const nowHour = Math.floor(now / 60)
  const firstHour = Math.min(DAY_START, nowHour, ...plans.map((p) => p.hour), ...spans.map((s) => Math.floor(s.start / 60)))
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i)
  const startHour = Math.max(firstHour, nowHour - 1)
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
      {heading(empty ? null : `할 일 ${plans.length}개 · 공부 ${formatDuration(studied)}`)}

      <ol
        ref={listRef}
        tabIndex={0}
        aria-label="시간별 할 일과 공부한 시간"
        className="relative overflow-y-auto overscroll-contain rounded-md [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        style={{ maxHeight: ROW * VISIBLE_ROWS }}
      >
        {hours.map((h) => {
          const rowPlans = plans.filter((p) => p.hour === h)
          const inHour = spans.filter((s) => s.start < (h + 1) * 60 && s.end > h * 60)
          const startsHere = spans.filter((s) => Math.floor(s.start / 60) === h)
          const current = h === nowHour
          return (
            <li
              key={h}
              data-start={h === startHour ? "" : undefined}
              aria-current={current ? "time" : undefined}
              className="flex items-stretch gap-2"
              style={{ minHeight: ROW }}
            >
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

              {/* No grid lines: an hour that holds something is a white block on the tinted panel, an empty hour is
                  just open space — so what is planned stands out and free time reads as one stretch. */}
              <span
                className={`my-0.5 flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-md px-2 py-1 ${
                  rowPlans.length > 0 || startsHere.length > 0 ? "bg-background ring-1 ring-action-100" : ""
                }`}
              >
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
          <p className="mb-1 px-1 text-xs text-muted-foreground">학습 계획 · 오늘 몫</p>
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

      {empty && todoTimes && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">체크리스트에서 할 일의 시계를 누르면 그 시각에 들어가요.</p>
      )}
    </section>
  )
}
