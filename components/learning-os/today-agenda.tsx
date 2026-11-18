"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { CalendarRange, ChevronDown, RotateCcw, Target } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates, reviewHref, type StudyCandidate } from "@/lib/study-candidates"
import { dueToneClass, formatDuration } from "@/lib/study-pages"
import { activePlans, isPlanTodo, planToday, type ActivePlan } from "@/lib/study-stats"
import { usePlans } from "@/lib/plans"
import { useWorkspace } from "@/lib/workspace"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"
import { ChecklistBody } from "@/components/checklist-widget"
import { TimePicker } from "@/components/time-picker"
import { button } from "@/components/ui-styles"
import { MIN_DRAWN_MINUTES } from "@/lib/timetable"
import { useTimeSlots } from "@/lib/time-slots"
import { addTodo, todayChecklist, useTodos, useTodosStatus } from "@/lib/todos"
import { RuledHeader } from "@/components/page-shell"

const REVIEW_LIMIT = 3

// 오늘의 할 일 (개편안 D-43): one list, not three boxes. Notes due for review, what each running plan asks of today
// (D-38's 계획에서 오늘 할 몫, moved here from under the timetable) and the to-dos share one row shape — a 20px mark,
// the name with one line under it, and what to do on the right — so "what do I do today" is answered in one place.
// A plan's share becomes an ordinary to-do once it has an hour (no link is stored, D-38).
export function TodayAgenda() {
  const workspace = useWorkspace()
  const plans = usePlans()
  const today = useTodayISO()
  const todos = useTodos()
  const { todoTimes } = useTimeSlots()
  const reviews = today ? reviewCandidates(workspace, today) : null
  const running = today ? activePlans(workspace, plans, today) : null
  // Before the todos table exists the checklist can't save anything, so it stays out of sight.
  const checklistAvailable = useTodosStatus() !== "unavailable"
  const checklist = today ? todayChecklist(todos, today) : []
  // A plan counts as something left only while it still asks for time today and isn't already a to-do (that to-do
  // is counted once, as a to-do).
  const plansLeft = (running ?? []).filter((item) => planToday(item) && !checklist.some((t) => isPlanTodo(t.title, item.plan.title)))
  const left = (reviews?.length ?? 0) + plansLeft.length + checklist.filter((t) => t.doneAt === null).length

  return (
    <section aria-labelledby="today-agenda-title">
      <RuledHeader
        id="today-agenda-title"
        title="할 일"
        aside={
          // One way into 계획 (the list and [계획 만들기] are both on /plan), next to how much is left.
          <span className="flex items-center gap-3">
            {reviews !== null && left > 0 && <span className="tabular-nums">{`${left}개 남음`}</span>}
            <Link href="/plan" className="inline-flex items-center gap-1 font-medium text-action-700 hover:underline">
              <CalendarRange className="size-3.5" aria-hidden="true" />
              계획
            </Link>
          </span>
        }
      />

      {today === null || reviews === null || running === null ? (
        <Skeleton />
      ) : (
        <>
          {reviews.length > 0 && <ReviewList reviews={reviews} />}
          {running.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {running.map((item) => (
                <PlanRow
                  key={item.plan.id}
                  item={item}
                  today={today}
                  canTime={todoTimes}
                  scheduled={checklist.some((t) => isPlanTodo(t.title, item.plan.title))}
                />
              ))}
            </ul>
          )}
          {reviews.length === 0 && running.length === 0 && (
            <Empty>복습할 노트도 진행 중인 계획도 없어요. 할 일을 적거나 계획을 만들어 보세요.</Empty>
          )}
        </>
      )}

      {checklistAvailable && (
        <div className="mt-0.5">
          <ChecklistBody />
        </div>
      )}
    </section>
  )
}

// The mark at the start of a row: what kind of thing it is, the same size as a to-do's check box.
function RowMark({ icon: Icon }: { icon: typeof RotateCcw }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-action-50 text-action-700" aria-hidden="true">
      <Icon className="size-3.5" />
    </span>
  )
}

function ReviewRow({ item, first }: { item: StudyCandidate; first: boolean }) {
  return (
    <li>
      <Link
        href={reviewHref(item.pageId)}
        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent ${first ? "bg-action-50" : ""}`}
      >
        <RowMark icon={RotateCcw} />
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
        {/* Every row says what it does in the same quiet way; the first one is marked by its background, since the
            screen's one filled button is [공부 시작] (D-40, 개편안 D-43). */}
        <span className={`shrink-0 text-xs font-medium group-hover:text-foreground ${first ? "text-action-700" : "text-muted-foreground"}`}>
          {item.action}
        </span>
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
      <ul id={listId} className="flex flex-col gap-0.5">
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
          className="mb-1 ml-9 inline-flex items-center gap-0.5 rounded-md py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500"
        >
          {all ? "접기" : `복습할 노트 ${reviews.length - REVIEW_LIMIT}개 더 보기`}
          <ChevronDown className={`size-3.5 transition-transform motion-reduce:transition-none ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </>
  )
}

function PlanRow({ item, today, canTime, scheduled }: { item: ActivePlan; today: string; canTime: boolean; scheduled: boolean }) {
  const { plan } = item
  const ask = planToday(item)
  const left = item.daysLeft === 0 ? "오늘 마감" : `${item.daysLeft}일 남음`
  const progress = plan.goalMinutes ? `${formatDuration(item.studiedMinutes)} / ${formatDuration(plan.goalMinutes)}` : formatDuration(item.studiedMinutes)
  const title = item.targetHref ? (
    <Link href={item.targetHref} className="truncate text-sm font-medium text-foreground hover:underline">
      {plan.title}
    </Link>
  ) : (
    <span className="truncate text-sm font-medium text-foreground">{plan.title}</span>
  )
  return (
    <li className="relative flex items-center gap-2 rounded-md px-2 py-1.5">
      <RowMark icon={Target} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {title}
          {ask?.minutes ? <span className="shrink-0 text-xs font-medium text-action-700">{`오늘 ${formatDuration(ask.minutes)}`}</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {`${item.targetLabel} · ${progress} · `}
          <span className={item.daysLeft <= 1 ? "font-medium text-attention-700" : ""}>{left}</span>
        </span>
      </span>
      {!ask ? (
        <span className="shrink-0 text-xs font-medium text-success-700">목표 채움</span>
      ) : scheduled ? (
        <span className="shrink-0 text-xs text-muted-foreground">할 일에 있음</span>
      ) : canTime ? (
        <TimePicker
          startMin={null}
          durationMin={null}
          onChange={(start) => start !== null && addTodo(ask.title, today, start, ask.minutes === null ? null : Math.max(MIN_DRAWN_MINUTES, ask.minutes))}
          withDuration={false}
          closeOnPick
          label={`${plan.title} 시간 정하기`}
          className={() => button("ghost", "sm", "h-7 px-2 text-xs text-action-700 hover:text-action-700")}
        >
          시간 정하기
        </TimePicker>
      ) : null}
    </li>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">{children}</p>
}

function Skeleton() {
  return <div className="mx-2 h-10 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
}
