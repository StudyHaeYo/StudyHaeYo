"use client"

import Link from "next/link"
import { useState } from "react"
import { TrendingDown, TrendingUp, Lightbulb } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDate, formatDuration } from "@/lib/study-pages"
import {
  breakdownSlot,
  OTHER_KEY,
  studyBreakdown,
  studyInsights,
  trendAverage,
  trendReady,
  weeklyTrend,
  type BreakdownBucket,
  type StudyBreakdown,
  type Insight,
} from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const WEEKS = 8
const CHART_HEIGHT = 120

function weekLabel(start: string) {
  const [, m, d] = start.split("-").map(Number)
  return `${m}/${d}`
}

const insightIcon: Record<Insight["tone"], { icon: typeof TrendingUp; className: string }> = {
  up: { icon: TrendingUp, className: "text-success-600" },
  down: { icon: TrendingDown, className: "text-attention-600" },
  info: { icon: Lightbulb, className: "text-action-600" },
}

type Unit = "week" | "day"

const SLOT_CLASS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"]
const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]

// A subject's own hue, or the gray "기타" for subjects past the first four.
function slotClass(legend: StudyBreakdown["legend"], key: string) {
  const slot = breakdownSlot(legend, key)
  return SLOT_CLASS[legend[slot]?.key === OTHER_KEY ? 4 : Math.max(0, slot)]
}

function bucketLabel(bucket: BreakdownBucket, unit: Unit, index: number) {
  if (unit === "day") return bucket.isCurrent ? "오늘" : DAY_NAMES[index]
  return bucket.isCurrent ? "이번 주" : weekLabel(bucket.start)
}

function bucketTitle(bucket: BreakdownBucket, unit: Unit, index: number) {
  if (unit === "day") return `${formatDate(bucket.start)}(${DAY_NAMES[index]})${bucket.isCurrent ? " · 오늘" : ""}`
  return `${formatDate(bucket.start)} ~ ${formatDate(bucket.end)}${bucket.isCurrent ? " · 이번 주" : ""}`
}

// 학습 분석: study time per week (or per day of this week), each bar split by subject, with the subjects and notes
// of the chosen bar listed under it (2026-11-16, "하루 총 시간만 나온다"). A few plain-language readings sit beside it.
export function AnalyticsTrend() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const [unit, setUnit] = useState<Unit>("week")
  const [pinned, setPinned] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const data = today ? studyBreakdown(workspace, today, unit, WEEKS) : null
  const weeks = today ? weeklyTrend(workspace, today, WEEKS) : null
  const insights = today ? studyInsights(workspace, today) : null
  const ready = data !== null && weeks !== null && (unit === "week" ? trendReady(weeks) : data.buckets.some((b) => b.minutes > 0))
  const average = unit === "week" && weeks && trendReady(weeks) ? trendAverage(weeks) : null
  const max = Math.max(...(data?.buckets.map((b) => b.minutes) ?? []), 1)
  const current = data ? data.buckets.findIndex((b) => b.isCurrent) : -1
  const activeIndex = hovered ?? pinned ?? current
  const active = data?.buckets[activeIndex] ?? null

  const switchUnit = (next: Unit) => {
    setUnit(next)
    setPinned(null)
    setHovered(null)
  }

  return (
    <section aria-labelledby="trend-title" className="grid gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-baseline gap-3">
            <h2 id="trend-title" className="text-lg font-semibold tracking-tight text-foreground">
              학습 시간
            </h2>
            {average && (
              <span className="text-xs text-muted-foreground">{`지난 ${average.weeks}주 평균 ${formatDuration(average.minutes)}`}</span>
            )}
          </div>
          <div role="group" aria-label="보기 단위" className="flex rounded-lg bg-muted p-0.5 text-xs">
            {(
              [
                ["week", "주별"],
                ["day", "이번 주"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={unit === value}
                onClick={() => switchUnit(value)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500 ${
                  unit === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {data === null ? (
          <div className="animate-pulse rounded-lg bg-muted" style={{ height: CHART_HEIGHT + 60 }} aria-hidden="true" />
        ) : !ready ? (
          <p className="text-sm text-muted-foreground text-pretty">
            {unit === "week"
              ? "최근 8주 중 두 주 이상 공부한 기록이 쌓이면 주별 변화를 보여 드려요."
              : "이번 주에 남긴 학습 기록이 아직 없어요."}
            {unit === "week" && weeks!.at(-1)!.minutes > 0 && ` 이번 주는 지금까지 ${formatDuration(weeks!.at(-1)!.minutes)} 공부했어요.`}
          </p>
        ) : (
          <>
            <ul aria-label="과목" className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
              {data.legend.map((item) => (
                <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`size-2.5 shrink-0 rounded-[3px] ${slotClass(data.legend, item.key)}`} aria-hidden="true" />
                  <span className="text-foreground">{item.name}</span>
                  <span className="tabular-nums">{formatDuration(item.minutes)}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-end gap-2" onMouseLeave={() => setHovered(null)}>
              {data.buckets.map((bucket, i) => {
                const height = bucket.minutes === 0 ? 3 : Math.max(8, Math.round((bucket.minutes / max) * CHART_HEIGHT))
                const isActive = i === activeIndex
                const label = bucketLabel(bucket, unit, i)
                return (
                  <button
                    key={bucket.start}
                    type="button"
                    disabled={bucket.future}
                    aria-pressed={pinned === i}
                    aria-label={`${bucketTitle(bucket, unit, i)} ${bucket.minutes > 0 ? formatDuration(bucket.minutes) : "기록 없음"}${bucket.subjects
                      .map((x) => `, ${x.name} ${formatDuration(x.minutes)}`)
                      .join("")}`}
                    onClick={() => setPinned(i)}
                    onMouseEnter={() => setHovered(i)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md pt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 disabled:cursor-default"
                  >
                    <span className={`h-4 whitespace-nowrap text-xs tabular-nums ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {/* Phones: only the chosen bar is labeled; eight labels collide on narrow bars. */}
                      <span className="sm:hidden">{bucket.minutes > 0 && isActive ? compactDuration(bucket.minutes) : ""}</span>
                      <span className="hidden sm:inline">{bucket.minutes > 0 ? formatDuration(bucket.minutes) : ""}</span>
                    </span>
                    <span className="flex w-full items-end justify-center" style={{ height: CHART_HEIGHT }}>
                      {bucket.minutes === 0 ? (
                        <span className="w-full max-w-14 rounded-t-[4px] bg-muted" style={{ height }} />
                      ) : (
                        <span
                          className={`flex w-full max-w-14 flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity ${isActive ? "" : "opacity-55 group-hover:opacity-100"}`}
                          style={{ height }}
                        >
                          {bucket.subjects.map((x) => (
                            <span
                              key={x.key}
                              className={`w-full shrink-0 ${slotClass(data.legend, x.key)}`}
                              style={{ flexGrow: x.minutes, flexBasis: 0, minHeight: 2 }}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <span
                      className={`whitespace-nowrap border-b-2 pb-0.5 text-xs ${
                        isActive ? "border-action-600 font-semibold text-foreground" : "border-transparent text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>

            {active && (
              <div className="mt-4 border-t border-border pt-3" aria-live="polite">
                <p className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{bucketTitle(active, unit, activeIndex)}</span>
                  <span className="tabular-nums text-muted-foreground">{active.minutes > 0 ? formatDuration(active.minutes) : "기록 없음"}</span>
                </p>
                {active.subjects.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {active.subjects.map((x) => {
                      return (
                        <li key={x.key} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`size-2.5 shrink-0 rounded-[3px] ${slotClass(data.legend, x.key)}`} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-foreground">{x.name}</span>
                            <span className="tabular-nums text-muted-foreground">{formatDuration(x.minutes)}</span>
                          </div>
                          <p className="ml-[18px] mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {x.notes.slice(0, 3).map((n, k) => (
                              <span key={n.key}>
                                {k > 0 && " · "}
                                <Link href={n.href} className="rounded hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-action-500">
                                  {n.title}
                                </Link>{" "}
                                <span className="tabular-nums">{formatDuration(n.minutes)}</span>
                              </span>
                            ))}
                            {x.notes.length > 3 && ` · 외 ${x.notes.length - 3}개`}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="mb-3 text-base font-semibold text-foreground">한눈에 보기</h3>
        {insights === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">학습 기록이 쌓이면 여기에서 변화를 알려 드려요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {insights.map((insight) => {
              const { icon: Icon, className } = insightIcon[insight.tone]
              return (
                <li key={insight.text} className="flex gap-2 text-sm leading-relaxed text-foreground">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden="true" />
                  {insight.text}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

// Narrow bars on phones: "5.3시간" instead of "5시간 15분".
function compactDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`
  return `${(minutes / 60).toFixed(1).replace(/\.0$/, "")}시간`
}
