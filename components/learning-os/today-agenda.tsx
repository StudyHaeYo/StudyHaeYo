"use client"

import Link from "next/link"
import { CalendarRange, ChevronRight, ListTodo, RotateCcw } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates, reviewHref, type StudyCandidate } from "@/lib/study-candidates"
import { dueToneClass, formatDate, formatDuration } from "@/lib/study-pages"
import { activePlans, type ActivePlan } from "@/lib/study-stats"
import { usePlans } from "@/lib/plans"
import { useWorkspace } from "@/lib/workspace"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"
import { ChecklistBody, useChecklistCount } from "@/components/checklist-widget"

const REVIEW_LIMIT = 3

// Home "오늘": what to do today in one place — notes to review, plans running now, and the checklist.
export function TodayAgenda() {
  const workspace = useWorkspace()
  const plans = usePlans()
  const today = useTodayISO()
  const reviews = today ? reviewCandidates(workspace, today) : null
  const running = today ? activePlans(workspace, plans, today) : null
  const checklistCount = useChecklistCount()

  return (
    <section aria-labelledby="today-agenda-title" className="mb-10">
      <h2 id="today-agenda-title" className="border-b border-border pb-2 text-base font-semibold text-foreground">
        오늘 할 일
      </h2>

      <div className="divide-y divide-border">
        <AgendaSection
          icon={RotateCcw}
          title="복습할 노트"
          aside={reviews && reviews.length > 0 ? `${reviews.length}개` : null}
        >
          {reviews === null ? (
            <Skeleton />
          ) : reviews.length === 0 ? (
            <Empty>오늘 복습할 학습 노트가 없어요. 새로운 내용을 학습해 보세요.</Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {reviews.slice(0, REVIEW_LIMIT).map((item, i) => (
                <ReviewRow key={item.pageId} item={item} first={i === 0} />
              ))}
              {reviews.length > REVIEW_LIMIT && (
                <li>
                  <Link
                    href="/analytics"
                    className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {`${reviews.length - REVIEW_LIMIT}개 더 · 학습 분석에서 보기`}
                    <ChevronRight className="size-3.5" />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </AgendaSection>

        <AgendaSection icon={CalendarRange} title="진행 중인 계획" aside={running && running.length > 0 ? `${running.length}개` : null}>
          {running === null ? (
            <Skeleton />
          ) : running.length === 0 ? (
            <Empty>
              오늘 진행 중인 계획이 없어요.{" "}
              <Link href="/plan" className="font-medium text-indigo-600 hover:underline">
                계획 만들기
              </Link>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-1">
              {running.map((item) => (
                <PlanRow key={item.plan.id} item={item} />
              ))}
            </ul>
          )}
        </AgendaSection>

        <AgendaSection icon={ListTodo} title="체크리스트" aside={checklistCount}>
          <ChecklistBody />
        </AgendaSection>
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
        className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent ${first ? "bg-indigo-50" : ""}`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{item.topic}</span>
            <UnresolvedBadge count={item.unresolvedConfusions} />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {item.subject} · 마지막 학습 {item.lastStudied}
            {item.understanding !== null ? ` · 이해도 ${item.understanding}/5` : ""}
          </span>
        </span>
        <span className={`shrink-0 text-xs font-medium ${dueToneClass[item.dueTone]}`}>{item.due}</span>
        {first ? (
          <span className="inline-flex shrink-0 items-center rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors group-hover:bg-indigo-700">
            복습하기
          </span>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </Link>
    </li>
  )
}

function PlanRow({ item }: { item: ActivePlan }) {
  const { plan } = item
  const left = item.daysLeft === 0 ? "오늘 마감" : `${item.daysLeft}일 남음`
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{plan.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.targetLabel} · {formatDate(plan.startDate)} ~ {formatDate(plan.endDate)}
          {plan.goal ? ` · 목표: ${plan.goal}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-medium tabular-nums text-foreground">
          {formatDuration(item.studiedMinutes)}
          {plan.goalMinutes ? <span className="font-normal text-muted-foreground">{` / ${formatDuration(plan.goalMinutes)}`}</span> : null}
        </span>
        <span className="text-xs text-muted-foreground">{left}</span>
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
