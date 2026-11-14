"use client"

import Link from "next/link"
import { X } from "lucide-react"
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
      ? { text: startsIn(item.daysLeft - item.totalDays + 1), className: "text-muted-foreground" }
      : ended
        ? { text: "끝남", className: "text-muted-foreground" }
        : item.daysLeft === 0
          ? { text: "오늘 마감", className: "font-medium text-attention-700" }
          : { text: `${item.daysLeft}일 남음`, className: item.daysLeft <= 1 ? "font-medium text-attention-700" : "text-muted-foreground" }
  // With a goal time the bar shows study time against it; otherwise how far through the period we are.
  const goal = plan.goalMinutes
  const percent = goal
    ? Math.min(100, Math.round((item.studiedMinutes / goal) * 100))
    : Math.round((item.elapsedDays / item.totalDays) * 100)

  // A row in a ruled list, like every other list in the app (D-25 문서형): name and what it covers on the left; the
  // time, a short bar and the days left on the right. Colour only when the plan ends today or tomorrow.
  return (
    <li className={`group relative py-4 ${ended ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-[15px] font-medium text-foreground">{plan.title}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
            {showTarget &&
              (item.targetHref ? (
                <Link href={item.targetHref} className="font-medium text-action-700 hover:underline">
                  {item.targetLabel}
                </Link>
              ) : (
                <span>{item.targetLabel}</span>
              ))}
            {showTarget && <span aria-hidden="true">·</span>}
            <span className="tabular-nums">
              {formatDate(plan.startDate)} ~ {formatDate(plan.endDate)}
            </span>
            {plan.goal && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-foreground">{plan.goal}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="flex flex-col items-end gap-1.5">
            {phase !== "upcoming" && (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatDuration(item.studiedMinutes)}
                {goal ? <span className="font-normal text-muted-foreground">{` / ${formatDuration(goal)}`}</span> : null}
              </span>
            )}
            <div
              className="h-1 w-32 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={goal ? "목표 시간 대비 학습" : "기간 진행"}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              title={ended ? `${item.totalDays}일 계획` : item.elapsedDays === 0 ? `${item.totalDays}일 계획` : `${item.totalDays}일 중 ${item.elapsedDays}일째`}
            >
              <div className={`h-full rounded-full ${ended ? "bg-muted-foreground/40" : "bg-action-500"}`} style={{ width: `${percent}%` }} />
            </div>
            <span className={`text-xs tabular-nums ${badge.className}`}>{badge.text}</span>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${plan.title} 계획 삭제`}
              className="-mr-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function startsIn(days: number) {
  return days === 1 ? "내일 시작" : `${days}일 뒤 시작`
}
