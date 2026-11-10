"use client"

import { Check } from "lucide-react"
import { formatDuration } from "@/lib/study-pages"

// PROTOTYPE (시안): 오늘 시간표 — a Notion-style list, one row per hour. A row holds the to-dos set for that hour
// (같은 체크 상자 as the checklist) and, on the right, how long was actually studied in that hour.
// Values are made up for the mockup; nothing here reads or saves data yet.

const START = 7
const END = 24

type Plan = { hour: number; title: string; done?: boolean }

const PLANS: Plan[] = [
  { hour: 8, title: "영단어 30개", done: true },
  { hour: 13, title: "자료구조 4장 읽기" },
  { hour: 19, title: "정보처리기사 기출 1회" },
]
// Minutes studied in each hour (from records' start time).
const STUDIED: Record<number, number> = { 9: 50 }
const NOW_HOUR = 16

export function TodayTimetable() {
  const hours = Array.from({ length: END - START }, (_, i) => START + i)
  const studied = Object.values(STUDIED).reduce((a, b) => a + b, 0)

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

      <ol className="rounded-lg bg-muted/70 px-1.5 py-1">
        {hours.map((h) => {
          const plans = PLANS.filter((p) => p.hour === h)
          const minutes = STUDIED[h] ?? 0
          const now = h === NOW_HOUR
          const past = h < NOW_HOUR
          return (
            <li
              key={h}
              aria-current={now ? "time" : undefined}
              className={`flex min-h-7 items-start gap-2 border-b border-border/70 px-1.5 py-1 last:border-b-0 ${
                now ? "-mx-0.5 rounded-md border-transparent bg-background px-2 shadow-[0_0_0_1px_var(--border)]" : ""
              }`}
            >
              <span
                className={`w-8 shrink-0 pt-px text-xs tabular-nums ${
                  now ? "font-semibold text-foreground" : past ? "text-muted-foreground/70" : "text-muted-foreground"
                }`}
              >
                {h}시
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
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
                    <span className={`truncate text-sm ${p.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {p.title}
                    </span>
                  </span>
                ))}
              </span>
              {minutes > 0 && (
                <span className="shrink-0 pt-px text-xs tabular-nums text-muted-foreground">
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-action-600 align-middle" aria-hidden="true" />
                  공부 {formatDuration(minutes)}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-2.5 text-xs text-muted-foreground">할 일에서 시각을 고르면 여기에 들어가요.</p>
    </section>
  )
}
