"use client"

import { useState } from "react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDate, formatDuration } from "@/lib/study-pages"
import { studyCalendar, type StudyDay } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

// PROTOTYPE (시안): 학습 기록 맨 위 — the last 7 days as bars (real minutes) and, for the picked day, a 24-hour ring of
// when the study happened. The ring's times are made up: records have no start time yet.

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"]
const BAR_HEIGHT = 96
const SIZE = 176
const R = 70
const STROKE = 14

// Made-up sessions for the mockup: [start hour, minutes], plus minutes with no time.
function mockSessions(day: StudyDay, index: number): { spans: [number, number][]; untimed: number } {
  if (day.minutes === 0) return { spans: [], untimed: 0 }
  const untimed = index < 4 ? Math.round(day.minutes * 0.3) : 0
  const timed = day.minutes - untimed
  if (timed <= 60) return { spans: [[9 + 1 / 6, timed]], untimed }
  const first = Math.round(timed * 0.55)
  return { spans: [[10, first], [20, timed - first]], untimed }
}

function point(hour: number, r: number) {
  const a = (hour / 24) * Math.PI * 2 - Math.PI / 2
  return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)]
}

function arcPath(start: number, minutes: number) {
  const end = start + minutes / 60
  const [x1, y1] = point(start, R)
  const [x2, y2] = point(end, R)
  return `M${x1} ${y1} A${R} ${R} 0 ${end - start > 12 ? 1 : 0} 1 ${x2} ${y2}`
}

export function StudyTimeChart() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const days = today
    ? studyCalendar(workspace, today, 2)
        .flat()
        .filter((d) => !d.future)
        .slice(-7)
        // PROTOTYPE: fill the empty sample days so the mockup shows a week.
        .map((d, i) => (d.minutes > 0 ? d : { ...d, minutes: [40, 95, 0, 120, 70, 150, 0][i] }))
    : null
  const [picked, setPicked] = useState<string | null>(null)

  if (!days) return <div className="mt-6 h-[13.5rem] animate-pulse rounded-xl bg-muted" aria-hidden="true" />

  const pickedIndex = Math.max(0, days.findIndex((d) => d.date === (picked ?? today)))
  const day = days[pickedIndex]
  const { spans, untimed } = mockSessions(day, pickedIndex)
  const max = Math.max(...days.map((d) => d.minutes), 1)
  const total = days.reduce((sum, d) => sum + d.minutes, 0)

  return (
    <section aria-labelledby="study-time-title" className="mt-6 grid gap-6 rounded-xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="study-time-title" className="text-[15px] font-semibold text-foreground">
            최근 7일
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">합계 {formatDuration(total)}</span>
        </div>
        <div className="flex items-end gap-2" role="group" aria-label="날짜 고르기">
          {days.map((d, i) => {
            const selected = i === pickedIndex
            const height = d.minutes === 0 ? 3 : Math.max(8, Math.round((d.minutes / max) * BAR_HEIGHT))
            const weekday = DAY_NAMES[new Date(`${d.date}T00:00:00`).getDay()]
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={selected}
                aria-label={`${formatDate(d.date)} ${d.minutes > 0 ? formatDuration(d.minutes) : "기록 없음"}`}
                onClick={() => setPicked(d.date)}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md pt-1 outline-none focus-visible:ring-2 focus-visible:ring-action-400"
              >
                <span className={`h-4 whitespace-nowrap text-[11px] tabular-nums ${selected ? "font-semibold text-foreground" : "text-transparent group-hover:text-muted-foreground"}`}>
                  {d.minutes > 0 ? formatDuration(d.minutes) : ""}
                </span>
                <span className="flex w-full items-end" style={{ height: BAR_HEIGHT }}>
                  <span
                    className={`w-full rounded-t-md transition-colors ${
                      d.minutes === 0 ? "bg-muted" : selected ? "bg-action-600" : "bg-action-300 group-hover:bg-action-400"
                    }`}
                    style={{ height }}
                  />
                </span>
                <span className={`whitespace-nowrap text-[11px] ${selected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {d.date === today ? "오늘" : `${weekday} ${Number(d.date.slice(8))}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center border-t border-border pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${formatDate(day.date)} 공부한 시간대`}
          className="shrink-0"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-muted" />
          {Array.from({ length: 24 }, (_, h) => {
            const [x1, y1] = point(h, R + STROKE / 2 + 2)
            const [x2, y2] = point(h, R + STROKE / 2 + (h % 6 === 0 ? 7 : 4))
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1} className="stroke-border" />
          })}
          {spans.map(([start, minutes]) => (
            <path key={start} d={arcPath(start, minutes)} fill="none" strokeWidth={STROKE} className="stroke-action-600" />
          ))}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = point(h, R - STROKE - 4)
            return (
              <text key={h} x={x} y={y + 4} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                {h}시
              </text>
            )
          })}
          <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" className="fill-foreground text-[15px] font-semibold tabular-nums">
            {day.minutes > 0 ? formatDuration(day.minutes) : "기록 없음"}
          </text>
          <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {day.date === today ? "오늘" : formatDate(day.date)}
          </text>
        </svg>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-[3px] bg-action-600" aria-hidden="true" />
          공부한 시간대
          {untimed > 0 && <span className="tabular-nums">· 시간대 없음 {formatDuration(untimed)}</span>}
        </p>
      </div>
    </section>
  )
}
