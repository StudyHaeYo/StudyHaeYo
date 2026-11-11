"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { formatDuration } from "@/lib/study-pages"

// PROTOTYPE (시안): 오늘 시간표 — one row per hour on a navy-tinted panel. Plans (to-dos with an hour) are the text of
// a row; the time actually studied is the rail beside the hour labels, filled to the minute. Hours before now fold
// into one summary line so the panel stays short. Values are made up; nothing here reads or saves data yet.

const START = 7
const END = 24
const ROW = 32 // px; the rail is drawn against this height

type Plan = { hour: number; title: string; done?: boolean }
type Span = { start: number; end: number; title: string }

const PLANS: Plan[] = [
  { hour: 8, title: "영단어 30개", done: true },
  { hour: 13, title: "자료구조 4장 읽기" },
  { hour: 19, title: "정보처리기사 기출 1회" },
]
const STUDIES: Span[] = [{ start: 9 + 10 / 60, end: 10, title: "그래프 탐색" }]
const NOW = 16 + 20 / 60

const minutesOf = (s: Span) => Math.round((s.end - s.start) * 60)

export function TodayTimetable() {
  const [earlier, setEarlier] = useState(false)
  const nowHour = Math.floor(NOW)
  const from = earlier ? START : Math.max(START, nowHour - 1)
  const hours = Array.from({ length: END - from }, (_, i) => from + i)
  const studied = STUDIES.reduce((sum, s) => sum + minutesOf(s), 0)

  const foldedPlans = PLANS.filter((p) => p.hour < nowHour - 1)
  const foldedStudied = STUDIES.filter((s) => s.start < nowHour - 1).reduce((sum, s) => sum + minutesOf(s), 0)

  return (
    <section aria-labelledby="today-timetable-title" className="rounded-xl bg-action-50 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id="today-timetable-title" className="text-base font-semibold text-foreground">
          오늘 시간표
        </h2>
        <p className="text-xs text-muted-foreground">
          계획 {PLANS.length}개 · 공부 {formatDuration(studied)}
        </p>
      </div>

      {nowHour - 1 > START && (
        <button
          type="button"
          onClick={() => setEarlier((v) => !v)}
          aria-expanded={earlier}
          className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-action-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        >
          <span className="truncate">
            {START}시~{nowHour - 1}시
            {foldedPlans.length > 0 && ` · 계획 ${foldedPlans.length}개 중 ${foldedPlans.filter((p) => p.done).length}개 완료`}
            {foldedStudied > 0 && ` · 공부 ${formatDuration(foldedStudied)}`}
          </span>
          <ChevronDown className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${earlier ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}

      <ol>
        {hours.map((h) => {
          const plans = PLANS.filter((p) => p.hour === h)
          const spans = STUDIES.filter((s) => s.start < h + 1 && s.end > h)
          const startsHere = STUDIES.filter((s) => Math.floor(s.start) === h)
          const now = h === nowHour
          return (
            <li key={h} aria-current={now ? "time" : undefined} className="flex items-stretch gap-2" style={{ minHeight: ROW }}>
              <span className={`w-7 shrink-0 pt-1.5 text-right text-xs tabular-nums ${now ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {h}시
              </span>

              {/* the rail: studied minutes of this hour, and where now is */}
              <span className="relative w-[3px] shrink-0 bg-action-200/70" aria-hidden="true">
                {spans.map((s) => {
                  const top = Math.max(0, s.start - h)
                  const bottom = Math.min(1, s.end - h)
                  return <span key={s.title} className="absolute inset-x-0 bg-action-600" style={{ top: `${top * 100}%`, height: `${(bottom - top) * 100}%` }} />
                })}
                {now && (
                  <span
                    className="absolute left-1/2 size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-action-50 bg-foreground"
                    style={{ top: `${(NOW - h) * 100}%` }}
                  />
                )}
              </span>

              <span className={`flex min-w-0 flex-1 flex-col justify-center gap-1 border-b border-action-100 py-1`}>
                {plans.map((p) => (
                  <span key={p.title} className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border ${
                        p.done ? "border-action-600 bg-action-600 text-action-foreground" : "border-input bg-background"
                      }`}
                      aria-hidden="true"
                    >
                      {p.done && <Check className="size-3" />}
                    </span>
                    <span className={`truncate text-sm ${p.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{p.title}</span>
                  </span>
                ))}
                {startsHere.map((s) => (
                  <span key={s.title} className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-action-700">{s.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(minutesOf(s))}</span>
                  </span>
                ))}
                {now && plans.length === 0 && startsHere.length === 0 && <span className="text-xs text-muted-foreground">지금</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
