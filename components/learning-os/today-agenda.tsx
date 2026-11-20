"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { CalendarRange, ChevronDown, ChevronRight, ListTodo, RotateCcw } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates, reviewHref, type StudyCandidate } from "@/lib/study-candidates"
import { dueToneClass, formatDuration } from "@/lib/study-pages"
import { activePlans, type ActivePlan } from "@/lib/study-stats"
import { slotsOn, usePlans, usePlanSlotsReady } from "@/lib/plans"
import { clockLabel } from "@/lib/timetable"
import { useWorkspace } from "@/lib/workspace"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"
import { ChecklistBody, useChecklistCount } from "@/components/checklist-widget"
import { useTodosStatus } from "@/lib/todos"
import { RuledHeader } from "@/components/page-shell"

const REVIEW_LIMIT = 3

// Home "오늘": what to do today in one place — notes to review, plans running now, and the checklist.
export function TodayAgenda() {
  const workspace = useWorkspace()
  const plans = usePlans()
  const today = useTodayISO()
  const reviews = today ? reviewCandidates(workspace, today) : null
  const running = today ? activePlans(workspace, plans, today) : null
  const checklistCount = useChecklistCount()
  // Before the todos table exists the checklist can't save anything, so it stays out of sight.
  const checklistAvailable = useTodosStatus() !== "unavailable"

  return (
    <section aria-labelledby="today-agenda-title">
      <RuledHeader id="today-agenda-title" title="오늘 할 일" />

      <div className="divide-y divide-border">
        <AgendaSection
          icon={RotateCcw}
          title="복습할 노트"
          aside={reviews && reviews.length > 0 ? `${reviews.length}개` : null}
        >
          {reviews === null ? (
            <Skeleton />
          ) : reviews.length === 0 ? (
            <Empty>오늘 복습할 노트가 없어요. 새로운 내용을 학습해 보세요.</Empty>
          ) : (
            <ReviewList reviews={reviews} />
          )}
        </AgendaSection>

        <AgendaSection icon={CalendarRange} title="진행 중인 계획" aside={running && running.length > 0 ? `${running.length}개` : null}>
          {running === null ? (
            <Skeleton />
          ) : running.length === 0 ? (
            <Empty>
              오늘 진행 중인 계획이 없어요.{" "}
              <Link href="/plan" className="font-medium text-action-600 hover:underline">
                계획 만들기
              </Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {running.map((item) => (
                <PlanRow key={item.plan.id} item={item} today={today} />
              ))}
            </ul>
          )}
        </AgendaSection>

        {checklistAvailable && (
          <AgendaSection icon={ListTodo} title="체크리스트" aside={checklistCount}>
            <ChecklistBody />
          </AgendaSection>
        )}
      </div>
    </section>
  )
}

function AgendaSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: typeof RotateCcw
  title: string
  aside: string | null
  children: React.ReactNode
}) {
  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-center justify-between px-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
          {title}
        </h3>
        {aside && <span className="text-xs font-medium text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </div>
  )
}

function ReviewRow({ item, first }: { item: StudyCandidate; first: boolean }) {
  return (
    <li>
      <Link
        href={reviewHref(item.pageId)}
        className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent ${first ? "bg-action-50" : ""}`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{item.topic}</span>
            <UnresolvedBadge count={item.unresolvedConfusions} quiet />
            {item.wrongProblems > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">틀린 문제 {item.wrongProblems}</span>
            )}
            {item.exam && <span className="shrink-0 text-xs text-muted-foreground">시험 {item.exam}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.subject} · 마지막 학습 {item.lastStudied}
            {item.understanding !== null ? ` · 이해도 ${item.understanding}/5` : ""}
          </span>
        </span>
        {/* Every row here is due now, so "다시 볼 때예요" / "오늘" would repeat the section's name on each line. Only a
            row that is not yet due (tomorrow's) says when. */}
        {item.dueTone !== "overdue" && item.dueTone !== "today" && (
          <span className={`shrink-0 text-xs font-medium ${dueToneClass[item.dueTone]}`}>{item.due}</span>
        )}
        {first ? (
          <span className="inline-flex shrink-0 items-center rounded-md bg-action-600 px-2.5 py-1 text-xs font-medium text-action-foreground transition-colors group-hover:bg-action-700">
            {item.action}
          </span>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </Link>
    </li>
  )
}

// The whole list lives here (D-31: one list in one place): the first few, the rest unfolded in place.
function ReviewList({ reviews }: { reviews: StudyCandidate[] }) {
  const [all, setAll] = useState(false)
  const listId = useId()
  const shown = all ? reviews : reviews.slice(0, REVIEW_LIMIT)
  return (
    <>
      <ul id={listId} className="flex flex-col gap-1">
        {shown.map((item, i) => (
          <ReviewRow key={item.pageId} item={item} first={i === 0} />
        ))}
      </ul>
      {reviews.length > REVIEW_LIMIT && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          aria-controls={listId}
          className="mt-1 inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        >
          {all ? "접기" : `${reviews.length - REVIEW_LIMIT}개 더 보기`}
          <ChevronDown className={`size-3.5 transition-transform motion-reduce:transition-none ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </>
  )
}

function PlanRow({ item, today }: { item: ActivePlan; today: string | null }) {
  const { plan } = item
  const pages = useWorkspace().pages
  const slotsReady = usePlanSlotsReady()
  // 공부할 시각 today (D-46): "오늘 19:00 해시테이블 정리".
  const todaySlots = slotsReady && today ? slotsOn(plan, today) : []
  const slotText = todaySlots
    .map((s) => `${clockLabel(s.startMin)} ${pages.find((p) => p.id === s.pageId)?.title || "지운 노트"}`)
    .join(", ")
  const left = item.daysLeft === 0 ? "오늘 마감" : `${item.daysLeft}일 남음`
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{plan.title}</span>
        {/* One fact under the name; the dates and the goal note are on 학습 계획. */}
        <span className="block truncate text-xs text-muted-foreground">
          {item.targetLabel}
          {slotText && <span className="text-action-700">{` · 오늘 ${slotText}`}</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatDuration(item.studiedMinutes)}
          {plan.goalMinutes ? <span className="font-normal text-muted-foreground">{` / ${formatDuration(plan.goalMinutes)}`}</span> : null}
        </span>
        <span className={`text-xs ${item.daysLeft <= 1 ? "font-medium text-attention-700" : "text-muted-foreground"}`}>{left}</span>
      </span>
    </>
  )
  const className = "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
  return (
    <li>
      {item.targetHref ? (
        <Link href={item.targetHref} className={className}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">{children}</p>
}

function Skeleton() {
  return <div className="mx-2 h-10 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
}
