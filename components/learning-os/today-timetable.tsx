"use client"

import { formatDuration } from "@/lib/study-pages"

// PROTOTYPE (시안): 오늘 시간표 — 계획(시각을 정한 할 일) and 공부(기록의 시작 시각) side by side, an hour per row.
// Values are made up for the mockup; nothing here reads or saves data yet.

const START = 8
const END = 24
const ROW = 26

type Block = { start: number; end: number; title: string; done?: boolean }

const PLANS: Block[] = [
  { start: 8.5, end: 9, title: "영단어 30개", done: true },
  { start: 13, end: 14.5, title: "자료구조 4장 읽기" },
  { start: 19, end: 21, title: "정보처리기사 기출 1회" },
]
const STUDIES: Block[] = [{ start: 9 + 10 / 60, end: 10, title: "그래프 탐색" }]
const NOW = 16 + 20 / 60

const hourLabel = (h: number) => `${h}`
const top = (h: number) => (h - START) * ROW
const minutesOf = (b: Block) => Math.round((b.end - b.start) * 60)
const clock = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`

export function TodayTimetable() {
  const studied = STUDIES.reduce((sum, b) => sum + minutesOf(b), 0)
  const hours = Array.from({ length: END - START }, (_, i) => START + i)

  return (
    <section aria-labelledby="today-timetable-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="today-timetable-title" className="text-base font-semibold text-foreground">
          오늘 시간표
        </h2>
        <p className="text-xs text-muted-foreground">
          계획 {PLANS.length}개 · 공부 {formatDuration(studied)}
        </p>
      </div>

      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-1.5 pb-1 text-[11px] text-muted-foreground">
        <span />
        <span className="pl-1">계획</span>
        <span className="pl-1">공부</span>
      </div>

      <div className="relative grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-1.5" style={{ height: (END - START) * ROW }}>
        {/* hour lines */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 flex items-start" style={{ top: top(h) }}>
              <span className="w-7 shrink-0 -translate-y-1 bg-background pr-1 text-right text-[11px] leading-none tabular-nums text-muted-foreground">
                {hourLabel(h)}
              </span>
              <span className="mt-px h-px flex-1 bg-border" />
            </div>
          ))}
        </div>

        <span />
        <Lane label="계획">
          {PLANS.map((b) => (
            <div
              key={b.title}
              title={`${clock(b.start)}~${clock(b.end)} ${b.title}`}
              className={`absolute inset-x-0 overflow-hidden rounded-md px-1.5 text-[11px] ${b.end - b.start < 1 ? "flex items-center leading-none" : "py-0.5 leading-snug"} ${
                b.done
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-action-50 text-action-900 ring-1 ring-inset ring-action-200"
              }`}
              style={{ top: top(b.start) + 1, height: (b.end - b.start) * ROW - 2 }}
            >
              <span className="block truncate font-medium">{b.title}</span>
              {b.end - b.start >= 1 && <span className="block tabular-nums text-action-700/80">{clock(b.start)}~{clock(b.end)}</span>}
            </div>
          ))}
        </Lane>
        <Lane label="공부">
          {STUDIES.map((b) => (
            <div
              key={b.title}
              title={`${clock(b.start)}~${clock(b.end)} ${b.title} · ${formatDuration(minutesOf(b))}`}
              className={`absolute inset-x-0 overflow-hidden rounded-md bg-action-600 px-1.5 text-[11px] text-action-foreground ${b.end - b.start < 1 ? "flex items-center gap-1 leading-none" : "py-0.5 leading-snug"}`}
              style={{ top: top(b.start) + 1, height: (b.end - b.start) * ROW - 2 }}
            >
              <span className="truncate font-medium">{b.title}</span>
              <span className="shrink-0 tabular-nums opacity-80">{formatDuration(minutesOf(b))}</span>
            </div>
          ))}
        </Lane>

        {/* now */}
        <div className="pointer-events-none absolute left-7 right-0 flex items-center" style={{ top: top(NOW) - 3 }} aria-hidden="true">
          <span className="size-1.5 rounded-full bg-foreground" />
          <span className="h-px flex-1 bg-foreground/70" />
        </div>
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">빈 칸을 누르면 그 시각에 할 일을 넣어요.</p>
    </section>
  )
}

function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="list" aria-label={label} className="relative">
      {children}
    </div>
  )
}
