"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "sonner"
import { useNowMinutes, useTodayISO } from "@/hooks/use-today"
import { addDays, formatDate, formatDuration } from "@/lib/study-pages"
import { allRecords, shiftMonth, studyMonth, studyStreak, weekStart, type StudyDay } from "@/lib/study-stats"
import { useStudySession } from "@/lib/study-session"
import { useTimeSlots } from "@/lib/time-slots"
import { useTodos, useTodosStatus } from "@/lib/todos"
import { usePlans, usePlanSlotsReady } from "@/lib/plans"
import { layoutLanes, planRange, rangeLabel } from "@/lib/timetable"
import { useWorkspace } from "@/lib/workspace"
import {
  addDday,
  ddayLabel,
  DDAY_TITLE_MAX,
  pastDdays,
  removeDday,
  restoreDday,
  upcomingDdays,
  useDdays,
  useDdaysStatus,
  type Dday,
} from "@/lib/ddays"
import { RuledHeader } from "@/components/page-shell"
import { button } from "@/components/ui-styles"
import {
  minutesOfDay,
  openScroll,
  planSlotSpans,
  sameLocalDay,
  studySpans,
  TodayTimetable,
} from "@/components/learning-os/today-timetable"

// 시간표 (D-44): one card on 오늘 that shows time at three sizes — [일] today's time grid (D-38), [주] the week as seven
// columns on the same kind of grid, [월] the month as a study calendar with the user's own D-days. One is shown at a
// time; the head names what is shown. The nearest D-days sit under the head in every view.

type View = "day" | "week" | "month"
const VIEWS: { id: View; label: string; title: string }[] = [
  { id: "day", label: "일", title: "오늘 시간표" },
  { id: "week", label: "주", title: "주간 시간표" },
  { id: "month", label: "월", title: "학습 달력" },
]
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

export function StudyCalendar() {
  const [view, setView] = useState<View>("day")
  const today = useTodayISO()
  const ddays = useDdays()
  const ddaysReady = useDdaysStatus() === "ready"
  const next = today && ddaysReady ? upcomingDdays(ddays, today).slice(0, 2) : []
  const current = VIEWS.find((v) => v.id === view)!

  return (
    <section aria-labelledby="study-calendar-title">
      <div className="mb-2">
        <RuledHeader
          id="study-calendar-title"
          title={current.title}
          aside={
            // Switching views happens often: no animation (emil-design-eng), only the pressed look.
            <div role="group" aria-label="시간표 보기" className="inline-flex rounded-lg bg-muted p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={view === v.id}
                  onClick={() => setView(v.id)}
                  className="touch-hit min-w-8 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-border"
                >
                  {v.label}
                  <span className="sr-only"> ({v.title})</span>
                </button>
              ))}
            </div>
          }
        />
      </div>

      {/* [월] lists every D-day under the calendar, so the line would say the same thing twice there. */}
      {today && next.length > 0 && view !== "month" && (
        <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {next.map((d) => (
            <span key={d.id} className="inline-flex min-w-0 items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-attention-500" aria-hidden="true" />
              <span className="truncate text-foreground">{d.title}</span>
              <span className="shrink-0 font-semibold tabular-nums text-attention-700">{ddayLabel(d.date, today)}</span>
            </span>
          ))}
        </p>
      )}

      {view === "day" && <TodayTimetable bare />}
      {view === "week" && <WeekTimetable />}
      {view === "month" && <MonthCalendar />}
    </section>
  )
}

// ---- [주]: Monday to Sunday on one time grid

const W_HOUR = 26 // px per hour: shorter than [일] (40), so most of a day fits before scrolling
const W_WINDOW = 12 // hours visible before scrolling
const W_EDGE = 8
const W_DAY_START = 8
const W_MIN_DRAWN = 40 // minutes: at 26px an hour, anything shorter can't hold a line of text

type WeekItem = { key: string; start: number; end: number; title: string } & (
  | { kind: "todo"; done: boolean }
  | { kind: "study" }
  | { kind: "slot"; pageId: string; plan: string }
)

function minutesOn(records: { date: string; durationMinutes: number }[], day: string) {
  return records.filter((r) => r.date === day).reduce((sum, r) => sum + r.durationMinutes, 0)
}

function WeekTimetable() {
  const today = useTodayISO()
  const now = useNowMinutes()
  const workspace = useWorkspace()
  const todos = useTodos()
  const todosStatus = useTodosStatus()
  const session = useStudySession()
  const { todoTimes, recordTimes } = useTimeSlots()
  const plans = usePlans()
  const slotsReady = usePlanSlotsReady()
  const ddays = useDdays()
  const ddaysReady = useDdaysStatus() === "ready"
  const [offset, setOffset] = useState(0) // weeks from this one

  const windowRef = useRef<HTMLDivElement>(null)
  const ready = today !== null && now !== null && todosStatus !== "loading" && (todoTimes || recordTimes)
  // Scrolled when the grid first shows and when the week changes — not every minute.
  useEffect(() => {
    const el = windowRef.current
    if (ready && el) el.scrollTop = openScroll(el, W_HOUR)
  }, [ready, offset])

  if (today === null || now === null || todosStatus === "loading") {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
  }
  if (!todoTimes && !recordTimes) {
    return <p className="text-xs leading-relaxed text-muted-foreground">시간표 준비 중</p>
  }

  const start = addDays(weekStart(today), offset * 7)
  const records = allRecords(workspace)
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    const items: WeekItem[] = []
    if (todoTimes) {
      for (const t of todos) {
        if (t.dueOn === day && t.startMin !== null) {
          items.push({
            key: t.id,
            kind: "todo",
            title: t.title,
            done: t.doneAt !== null,
            ...planRange(t.startMin, t.durationMin),
          })
        }
      }
    }
    if (recordTimes) for (const s of studySpans(workspace, day)) items.push({ ...s, kind: "study" })
    if (slotsReady) items.push(...planSlotSpans(plans, workspace.pages, day))
    if (day === today && session.startedAt !== null && sameLocalDay(session.startedAt, today)) {
      const s = minutesOfDay(session.startedAt)
      items.push({ key: "running", kind: "study", title: "공부 중", start: s, end: Math.max(now, s + 1) })
    }
    items.sort((a, b) => a.start - b.start)
    const drawn = items.map((it) => ({
      start: it.start,
      end: Math.min(1440, Math.max(it.end, it.start + W_MIN_DRAWN)),
    }))
    return { day, items, drawn, lanes: layoutLanes(drawn), minutes: minutesOn(records, day) }
  })
  const total = days.reduce((sum, d) => sum + d.minutes, 0)
  const all = days.flatMap((d) => d.items)
  const thisWeek = offset === 0
  const nowHour = Math.floor(now / 60)
  const firstHour = Math.min(W_DAY_START, ...all.map((it) => Math.floor(it.start / 60)))
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => firstHour + i)
  const y = (minutes: number) => W_EDGE + ((minutes - firstHour * 60) / 60) * W_HOUR
  // Opens at the week's first block, so the week is seen as a whole (this week: no later than the hour before now).
  const firstItemHour = all.length > 0 ? Math.min(...all.map((it) => Math.floor(it.start / 60))) : 9
  const openHour = Math.max(firstHour, thisWeek ? Math.min(firstItemHour, nowHour - 1) : firstItemHour)
  const openAt = Math.max(0, y(openHour * 60) - W_EDGE - 4)
  const ddayDates = new Set(ddaysReady ? ddays.map((d) => d.date) : [])
  const ddayNames = (day: string) =>
    ddaysReady ? ddays.filter((d) => d.date === day).map((d) => `${d.title} D-day`) : []
  const end = addDays(start, 6)
  const rangeText = `${formatDate(start)} ~ ${start.slice(5, 7) === end.slice(5, 7) ? `${Number(end.slice(8))}일` : formatDate(end)}`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="지난주"
            className={button("ghost", "icon-sm")}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="min-w-0 truncate text-sm font-medium tabular-nums text-foreground" aria-live="polite">
            {rangeText}
          </span>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="다음 주"
            className={button("ghost", "icon-sm")}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          {!thisWeek && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="touch-hit ml-1 shrink-0 rounded-sm text-xs font-medium text-action-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
            >
              이번 주
            </button>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {total > 0 ? `공부 ${formatDuration(total)}` : "공부 기록 없음"}
        </span>
      </div>

      {/* day heads: 요일 and date; today is marked, a D-day gets an amber dot */}
      <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] pb-1" aria-hidden="true">
        <span />
        {days.map(({ day }, i) => (
          <span
            key={day}
            className={`flex flex-col items-center text-xs leading-tight ${day === today ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {DAY_NAMES[i]}
            <span
              className={`tabular-nums ${day === today ? "rounded-full bg-foreground px-1.5 text-background" : ""}`}
            >
              {Number(day.slice(8))}
            </span>
            <span
              className={`mt-0.5 size-1 rounded-full ${ddayDates.has(day) ? "bg-attention-500" : "bg-transparent"}`}
            />
          </span>
        ))}
      </div>

      <div
        ref={windowRef}
        data-open={openAt}
        tabIndex={0}
        role="group"
        aria-label={`${rangeText} 시간별 할 일과 공부한 시간`}
        className="overflow-y-auto overscroll-contain rounded-md [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        style={{ maxHeight: W_HOUR * W_WINDOW }}
      >
        <div
          className="relative grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
          style={{ height: hours.length * W_HOUR + W_EDGE }}
        >
          {/* hour lines across the whole week, the label on its line */}
          <div aria-hidden="true" className="absolute inset-0">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 flex h-3 -translate-y-1/2 items-center"
                style={{ top: y(h * 60) }}
              >
                <span className="w-9 shrink-0 whitespace-nowrap pr-1 text-right text-xs leading-none tabular-nums text-muted-foreground">
                  {h}시
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ))}
          </div>
          <span />
          {days.map(({ day, items, drawn, lanes, minutes }, d) => (
            <ol
              key={day}
              aria-label={[
                `${formatDate(day)} ${DAY_NAMES[d]}요일`,
                ...ddayNames(day),
                ...(minutes > 0 ? [`공부 ${formatDuration(minutes)}`] : []),
              ].join(", ")}
              className={`relative border-l border-border/60 ${day === today ? "bg-action-50/60" : ""}`}
            >
              {day === today && thisWeek && (
                <li
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 h-px bg-foreground/70"
                  style={{ top: y(now) }}
                />
              )}
              {items.map((it, i) => {
                const top = y(drawn[i].start)
                const height = y(drawn[i].end) - top - 1
                const { lane, lanes: count } = lanes[i]
                const style = {
                  top: top + 0.5,
                  height,
                  left: `calc(${(lane / count) * 100}% + 1px)`,
                  width: `calc(${100 / count}% - 2px)`,
                }
                const range = rangeLabel(it.start, it.end)
                if (it.kind === "slot") {
                  // A plan's 공부할 시각 (D-46): opens the note.
                  return (
                    <li key={it.key} className="absolute" style={style}>
                      <Link
                        href={`/record/${it.pageId}`}
                        title={`${range} ${it.title} (${it.plan})`}
                        className="block h-full overflow-hidden rounded-[4px] bg-action-50 px-0.5 pt-0.5 text-xs leading-tight text-foreground ring-1 ring-inset ring-action-300 hover:bg-action-100 focus-visible:outline-2 focus-visible:outline-action-500"
                      >
                        <span className="block truncate">{it.title}</span>
                        <span className="sr-only">{`${range} 계획 ${it.plan}`}</span>
                      </Link>
                    </li>
                  )
                }
                if (it.kind === "study") {
                  return (
                    <li
                      key={it.key}
                      title={`${range} ${it.title} (공부함)`}
                      className="absolute overflow-hidden rounded-[4px] border-l-2 border-action-600 bg-action-100 px-0.5 pt-0.5 text-xs leading-tight text-action-900"
                      style={style}
                    >
                      <span className="block truncate">{it.title}</span>
                      <span className="sr-only">{range} 공부함</span>
                    </li>
                  )
                }
                return (
                  <li
                    key={it.key}
                    title={`${range} ${it.title}${it.done ? " (완료)" : ""}`}
                    className={`absolute overflow-hidden rounded-[4px] px-0.5 pt-0.5 text-xs leading-tight ring-1 ring-inset ${
                      it.done
                        ? "bg-background/70 text-muted-foreground line-through ring-action-100"
                        : "bg-background text-foreground ring-action-200"
                    }`}
                    style={style}
                  >
                    <span className="block truncate">{it.title}</span>
                    <span className="sr-only">
                      {range} 할 일{it.done ? ", 완료" : ""}
                    </span>
                  </li>
                )
              })}
            </ol>
          ))}
        </div>
      </div>

      {/* the two block kinds side by side, since the columns are too narrow to say it on each block */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border-l-2 border-action-600 bg-action-100" />
          공부한 시간
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-background ring-1 ring-inset ring-action-200" />할 일
        </span>
        {slotsReady && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-action-50 ring-1 ring-inset ring-action-300" />
            계획
          </span>
        )}
      </div>
      {all.length === 0 && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          이 주에 시각을 정한 할 일 · 기록 없음
        </p>
      )}
    </div>
  )
}

// ---- [월]: the month as a study calendar, with the user's D-days

// Study minutes → one of five shades (0, <30, <60, <120, 120+ minutes), one step lighter than the full scale so the
// calendar doesn't outshine 오늘 할 일 (2026-11-11).
function shade(day: StudyDay) {
  if (day.future) return "bg-transparent text-muted-foreground"
  if (day.minutes === 0) return "bg-muted text-muted-foreground"
  if (day.minutes < 30) return "bg-action-100 text-action-900"
  if (day.minutes < 60) return "bg-action-200 text-action-900"
  if (day.minutes < 120) return "bg-action-300 text-action-900"
  return "bg-action-500 text-action-foreground"
}

function MonthCalendar() {
  const today = useTodayISO()
  const workspace = useWorkspace()
  const ddays = useDdays()
  const ddaysReady = useDdaysStatus() === "ready"
  const [month, setMonth] = useState<string | null>(null) // null: this month

  if (today === null) return <div className="h-72 animate-pulse rounded-xl bg-muted" aria-hidden="true" />

  const thisMonth = today.slice(0, 7)
  const shown = month ?? thisMonth
  const weeks = studyMonth(workspace, shown, today)
  const studiedDays = weeks.flat().filter((d) => d && !d.future && d.minutes > 0).length
  const streak = studyStreak(workspace, today)
  const byDate = new Map<string, Dday[]>()
  if (ddaysReady) for (const d of ddays) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d])
  const [y, m] = shown.split("-").map(Number)
  const go = (n: number) =>
    setMonth((cur) => {
      const next = shiftMonth(cur ?? thisMonth, n)
      return next === thisMonth ? null : next
    })

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <button type="button" onClick={() => go(-1)} aria-label="지난달" className={button("ghost", "icon-sm")}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <span className="text-sm font-medium tabular-nums text-foreground" aria-live="polite">{`${y}년 ${m}월`}</span>
          <button type="button" onClick={() => go(1)} aria-label="다음 달" className={button("ghost", "icon-sm")}>
            <ChevronRight aria-hidden="true" />
          </button>
          {shown !== thisMonth && (
            <button
              type="button"
              onClick={() => setMonth(null)}
              className="touch-hit ml-1 shrink-0 rounded-sm text-xs font-medium text-action-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
            >
              이번 달
            </button>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {`${studiedDays}일 공부`}
          {shown === thisMonth && streak.current > 0 ? ` · ${streak.current}일 연속` : ""}
        </span>
      </div>

      <div
        role="img"
        aria-label={`${y}년 ${m}월에 ${studiedDays}일 공부했어요${
          ddaysReady ? `. 이 달의 D-day ${ddays.filter((d) => d.date.startsWith(shown)).length}개` : ""
        }`}
      >
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
          {DAY_NAMES.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} aria-hidden="true" />
            const marks = byDate.get(day.date) ?? []
            const tip = [
              `${formatDate(day.date)}${day.future ? "" : ` · ${day.minutes > 0 ? formatDuration(day.minutes) : "기록 없음"}`}`,
              ...marks.map((d) => `${d.title} ${ddayLabel(d.date, today)}`),
            ].join("\n")
            return (
              <span
                key={day.date}
                title={tip}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-xs tabular-nums ${shade(day)} ${
                  day.date === today ? "font-semibold ring-1 ring-foreground ring-offset-1 ring-offset-background" : ""
                }`}
              >
                {Number(day.date.slice(8))}
                {marks.length > 0 && <span className="absolute bottom-1 size-1.5 rounded-full bg-attention-500" />}
              </span>
            )
          })}
        </div>
      </div>

      {/* Big enough to read at a glance (외부 검토 11/8): the shades are the only key to the calendar. */}
      <div
        className="mt-2.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        {ddaysReady && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-attention-500" />
            D-day
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          적게
          {["bg-muted", "bg-action-100", "bg-action-200", "bg-action-300", "bg-action-500"].map((c) => (
            <span key={c} className={`size-3 rounded-[3px] ${c}`} />
          ))}
          많이
        </span>
      </div>

      {ddaysReady && <DdayPanel today={today} />}
    </div>
  )
}

function DdayPanel({ today }: { today: string }) {
  const ddays = useDdays()
  const upcoming = upcomingDdays(ddays, today)
  const past = pastDdays(ddays, today)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("이름을 적어 주세요.")
      titleRef.current?.focus()
      return
    }
    if (!date) {
      setError("날짜를 골라 주세요.")
      dateRef.current?.focus()
      return
    }
    addDday(title, date)
    setTitle("")
    setDate("")
    setError(null)
    titleRef.current?.focus()
  }
  const remove = (d: Dday) => {
    removeDday(d.id)
    toast(`"${d.title}" D-day를 지웠습니다.`, { action: { label: "되돌리기", onClick: () => restoreDday(d) } })
  }

  const row = (d: Dday, past: boolean) => (
    <li key={d.id} className="flex items-center gap-2 py-1">
      <span
        className={`w-12 shrink-0 text-xs font-semibold tabular-nums ${past ? "text-muted-foreground" : "text-attention-700"}`}
      >
        {ddayLabel(d.date, today)}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${past ? "text-muted-foreground" : "text-foreground"}`}>
        {d.title}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(d.date)}</span>
      <button
        type="button"
        onClick={() => remove(d)}
        aria-label={`${d.title} D-day 지우기`}
        className={button("ghost", "icon-sm", "size-7")}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  )

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">D-day</h3>
      {upcoming.length + past.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          시험 · 마감 날짜를 넣으면 시간표와 달력에 남은 날 표시
        </p>
      ) : (
        <ul>
          {upcoming.map((d) => row(d, false))}
          {past.map((d) => row(d, true))}
        </ul>
      )}
      <form onSubmit={submit} noValidate className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (error) setError(null)
          }}
          name="dday-title"
          aria-label="D-day 이름"
          autoComplete="off"
          maxLength={DDAY_TITLE_MAX}
          placeholder="예: 정보처리기사 실기…"
          className="h-8 min-w-0 flex-1 basis-36 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-action-500"
        />
        <input
          ref={dateRef}
          type="date"
          value={date}
          min={today}
          onChange={(e) => {
            setDate(e.target.value)
            if (error) setError(null)
          }}
          name="dday-date"
          aria-label="D-day 날짜"
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm tabular-nums text-foreground outline-none transition-colors focus:ring-2 focus:ring-action-500"
        />
        <button type="submit" className={button("secondary", "sm")}>
          <Check aria-hidden="true" />
          D-day 추가
        </button>
        {error && (
          <p role="alert" className="basis-full text-xs text-danger-700">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
