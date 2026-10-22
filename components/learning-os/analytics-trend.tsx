"use client"

import { TrendingDown, TrendingUp, Lightbulb } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { formatDuration } from "@/lib/study-pages"
import { studyInsights, weeklyTrend, type Insight } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

const WEEKS = 8
const CHART_HEIGHT = 120

function weekLabel(start: string) {
  const [, m, d] = start.split("-").map(Number)
  return `${m}/${d}`
}

const insightIcon: Record<Insight["tone"], { icon: typeof TrendingUp; className: string }> = {
  up: { icon: TrendingUp, className: "text-emerald-600" },
  down: { icon: TrendingDown, className: "text-amber-600" },
  info: { icon: Lightbulb, className: "text-indigo-600" },
}

// 학습 분석: weekly study time over the last 8 weeks, with a few plain-language readings next to it.
export function AnalyticsTrend() {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const weeks = today ? weeklyTrend(workspace, today, WEEKS) : null
  const insights = today ? studyInsights(workspace, today) : null
  const max = Math.max(...(weeks?.map((w) => w.minutes) ?? []), 1)
  const average = weeks ? Math.round(weeks.slice(0, -1).reduce((s, w) => s + w.minutes, 0) / (WEEKS - 1)) : 0

  return (
    <section aria-labelledby="trend-title" className="grid gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="trend-title" className="text-[15px] font-semibold text-foreground">
            주별 학습 시간
          </h2>
          {weeks && <span className="text-xs text-muted-foreground">지난 7주 평균 {formatDuration(average)}</span>}
        </div>
        {weeks === null ? (
          <div className="animate-pulse rounded-lg bg-muted" style={{ height: CHART_HEIGHT + 36 }} aria-hidden="true" />
        ) : (
          <div className="flex items-end gap-2" role="img" aria-label={`최근 ${WEEKS}주 주별 학습 시간`}>
            {weeks.map((week) => {
              const height = week.minutes === 0 ? 3 : Math.max(8, Math.round((week.minutes / max) * CHART_HEIGHT))
              return (
                <div key={week.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className={`h-4 whitespace-nowrap text-[11px] tabular-nums ${week.isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    <span className="sm:hidden">{week.minutes > 0 ? compactDuration(week.minutes) : ""}</span>
                    <span className="hidden sm:inline">{week.minutes > 0 ? formatDuration(week.minutes) : ""}</span>
                  </span>
                  <div className="flex w-full items-end" style={{ height: CHART_HEIGHT }}>
                    <div
                      className={`w-full rounded-t-md ${week.minutes === 0 ? "bg-muted" : week.isCurrent ? "bg-indigo-600" : "bg-indigo-300"}`}
                      style={{ height }}
                      title={`${weekLabel(week.start)} 주 · ${formatDuration(week.minutes)}`}
                    />
                  </div>
                  <span className={`whitespace-nowrap text-[11px] ${week.isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {week.isCurrent ? "이번 주" : weekLabel(week.start)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="mb-3 text-[15px] font-semibold text-foreground">한눈에 보기</h3>
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
