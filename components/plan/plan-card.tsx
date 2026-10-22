"use client"

import Link from "next/link"
import { CalendarRange, Flag, X } from "lucide-react"
import { formatDate, formatDuration } from "@/lib/study-pages"
import type { ActivePlan } from "@/lib/study-stats"

// One learning plan with where it stands today: days left, how far through the period, study time so far.
export function PlanCard({
  item,
  showTarget = true,
  onRemove,
}: {
  item: ActivePlan
  showTarget?: boolean
  onRemove?: () => void
}) {
  const { plan, phase } = item
  const ended = phase === "ended"
  const badge =
    phase === "upcoming"
      ? { text: startsIn(item.daysLeft - item.totalDays + 1), className: "bg-muted text-muted-foreground" }
      : ended
        ? { text: "끝남", className: "bg-muted text-muted-foreground" }
        : item.daysLeft === 0
          ? { text: "오늘 마감", className: "bg-amber-50 text-amber-700" }
          : { text: `${item.daysLeft}일 남음`, className: item.daysLeft <= 1 ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700" }
  const percent = Math.round((item.elapsedDays / item.totalDays) * 100)

  return (
    <li className={`group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ${ended ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-card-foreground">{plan.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.text}</span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${plan.title} 계획 삭제`}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {showTarget &&
        (item.targetHref ? (
          <Link
            href={item.targetHref}
            className="w-fit rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            {plan.target.scope === "all" ? item.targetLabel : `${plan.target.scope === "subject" ? "과목" : "페이지"} · ${item.targetLabel}`}
          </Link>
        ) : (
          <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{item.targetLabel}</span>
        ))}

      {plan.goal && (
        <p className="flex items-start gap-1.5 text-sm leading-relaxed text-foreground">
          <Flag className="mt-1 size-3.5 shrink-0 text-indigo-600" aria-hidden="true" />
          {plan.goal}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-1.5">
        {phase !== "upcoming" && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{ended ? "기간 중 학습" : "지금까지 학습"}</span>
            <span className={`text-sm font-semibold tabular-nums ${ended ? "text-foreground" : "text-indigo-600"}`}>
              {formatDuration(item.studiedMinutes)}
            </span>
          </div>
        )}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="기간 진행"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full rounded-full ${ended ? "bg-muted-foreground/40" : "bg-indigo-500"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="size-3.5" aria-hidden="true" />
            {formatDate(plan.startDate)} ~ {formatDate(plan.endDate)}
          </span>
          <span className="tabular-nums">
            {item.elapsedDays}/{item.totalDays}일
          </span>
        </p>
      </div>
    </li>
  )
}

function startsIn(days: number) {
  return days === 1 ? "내일 시작" : `${days}일 뒤 시작`
}
