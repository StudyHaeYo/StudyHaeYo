"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CalendarRange, ChevronDown, ChevronRight, ListTodo, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates, reviewHref, type StudyCandidate } from "@/lib/study-candidates"
import { dueToneClass, formatDuration } from "@/lib/study-pages"
import { activePlans, type ActivePlan } from "@/lib/study-stats"
import { usePlans } from "@/lib/plans"
import { importExampleData, useWorkspace } from "@/lib/workspace"
import { loadUserData, useDataStatus } from "@/lib/db/sync"
import { button } from "@/components/ui-styles"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"
import { ChecklistBody, useChecklistCount } from "@/components/checklist-widget"
import { useTodosStatus } from "@/lib/todos"
import { RuledHeader } from "@/components/page-shell"

const REVIEW_LIMIT = 3

// [예시로 한 바퀴] → the first review row explains itself once. FirstRun sits above the page grid (on a phone it comes
// before the timer), so the flag is shared through this tiny store; leaving 오늘 ends the tour.
let tourOn = false
const tourListeners = new Set<() => void>()
function setTourOn(on: boolean) {
  tourOn = on
  tourListeners.forEach((l) => l())
}
function useTour() {
  return useSyncExternalStore(
    (l) => {
      tourListeners.add(l)
      return () => tourListeners.delete(l)
    },
    () => tourOn,
    () => false,
  )
}

function useFirstVisit() {
  const workspace = useWorkspace()
  const status = useDataStatus()
  return status.phase === "ready" && workspace.pages.length === 0 && workspace.subjectRecords.length === 0
}

// Home "오늘": what to do today in one place — notes to review, plans running now, and the checklist.
// A brand-new account sees FirstRun above instead of empty review and plan sections (D-43).
export function TodayAgenda() {
  const workspace = useWorkspace()
  const plans = usePlans()
  const today = useTodayISO()
  const reviews = today ? reviewCandidates(workspace, today) : null
  const running = today ? activePlans(workspace, plans, today) : null
  const checklistCount = useChecklistCount()
  // Before the todos table exists the checklist can't save anything, so it stays out of sight.
  const checklistAvailable = useTodosStatus() !== "unavailable"
  const firstVisit = useFirstVisit()
  const tour = useTour()
  useEffect(() => () => setTourOn(false), [])

  return (
    <section aria-labelledby="today-agenda-title">
      <div>
        <RuledHeader
          id="today-agenda-title"
          title="오늘 할 일"
          aside={
            // 학습 계획 is not a menu any more (D-43): its list and [계획 만들기] open from here.
            <Link href="/plan" className="inline-flex items-center gap-1 font-medium text-action-700 hover:underline">
              <CalendarRange className="size-3.5" aria-hidden="true" />
              계획
            </Link>
          }
        />

        <div className="divide-y divide-border">
          {!firstVisit && (
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
                <ReviewList reviews={reviews} tour={tour} />
              )}
            </AgendaSection>
          )}

          {!firstVisit && (
            <AgendaSection
              icon={CalendarRange}
              title="진행 중인 계획"
              aside={running && running.length > 0 ? `${running.length}개` : null}
            >
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
                    <PlanRow key={item.plan.id} item={item} />
                  ))}
                </ul>
              )}
            </AgendaSection>
          )}

          {checklistAvailable && (
            <AgendaSection icon={ListTodo} title="체크리스트" aside={checklistCount}>
              <ChecklistBody />
            </AgendaSection>
          )}
        </div>
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

function ReviewRow({ item, first, tour }: { item: StudyCandidate; first: boolean; tour: boolean }) {
  // After [예시로 한 바퀴] the button that was pressed is gone; keyboard focus goes to where the tour says to start.
  const ref = useRef<HTMLAnchorElement>(null)
  const hintId = useId()
  useEffect(() => {
    if (tour) ref.current?.focus()
  }, [tour])
  return (
    // On the tour the row and its hint read as one block: the hint sits inside the row's tinted background.
    <li className={tour ? "rounded-lg bg-action-50" : undefined}>
      <Link
        ref={first ? ref : undefined}
        href={reviewHref(item.pageId)}
        aria-describedby={tour ? hintId : undefined}
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
            {item.subject} · {item.lastStudied === null ? "아직 공부 기록 없음" : `마지막 학습 ${item.lastStudied}`}
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
      {tour && (
        // Shown once, right after the example import: fades in so the change under the button is noticed (not on reduced motion).
        <p
          id={hintId}
          className="animate-in fade-in-0 slide-in-from-top-1 px-2 pb-2.5 text-sm leading-relaxed text-pretty text-foreground duration-200 ease-out motion-reduce:animate-none"
        >
          [{item.action}]부터 눌러 보세요. 가려진 답을 떠올려 보고 알았음 · 헷갈림 · 몰랐음을 고르면 다음 복습일이
          정해져요.
        </p>
      )}
    </li>
  )
}

// The whole list lives here (D-31: one list in one place): the first few, the rest unfolded in place.
function ReviewList({ reviews, tour }: { reviews: StudyCandidate[]; tour: boolean }) {
  const [all, setAll] = useState(false)
  const listId = useId()
  const shown = all ? reviews : reviews.slice(0, REVIEW_LIMIT)
  return (
    <>
      <ul id={listId} className="flex flex-col gap-1">
        {shown.map((item, i) => (
          <ReviewRow key={item.pageId} item={item} first={i === 0} tour={tour && i === 0} />
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
          <ChevronDown
            className={`size-3.5 transition-transform motion-reduce:transition-none ${all ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
    </>
  )
}

function PlanRow({ item }: { item: ActivePlan }) {
  const { plan } = item
  const left = item.daysLeft === 0 ? "오늘 마감" : `${item.daysLeft}일 남음`
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{plan.title}</span>
        {/* One fact under the name; the dates and the goal note are on 학습 계획. */}
        <span className="block truncate text-xs text-muted-foreground">{item.targetLabel}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatDuration(item.studiedMinutes)}
          {plan.goalMinutes ? (
            <span className="font-normal text-muted-foreground">{` / ${formatDuration(plan.goalMinutes)}`}</span>
          ) : null}
        </span>
        <span className={`text-xs ${item.daysLeft <= 1 ? "font-medium text-attention-700" : "text-muted-foreground"}`}>
          {left}
        </span>
      </span>
    </>
  )
  const className = "flex items-center gap-3 rounded-lg px-2 py-2"
  return (
    <li>
      {item.targetHref ? (
        <Link href={item.targetHref} className={`${className} transition-colors hover:bg-accent`}>
          {body}
        </Link>
      ) : (
        // Nothing to open (a plan over a whole folder): no hover, since hover promises a click.
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

// A new account: what the app does, as the loop it runs, and a way to try it before writing anything.
// Rendered by the page above its grid, so on a phone it comes before the timer.
export function FirstRun() {
  const firstVisit = useFirstVisit()
  if (!firstVisit) return null
  return <FirstRunCard />
}

function FirstRunCard() {
  const [importing, setImporting] = useState(false)
  const start = async () => {
    setImporting(true)
    const result = await importExampleData()
    setImporting(false)
    if (result === "imported") setTourOn(true)
    else if (result === "failed")
      toast.error("로그인이 풀려서 예시 데이터를 넣지 못했어요. 다시 로그인한 뒤 눌러 주세요.")
    else if (result === "not-empty") {
      // The DB already has rows this screen hasn't loaded (another tab); show them instead of importing.
      toast.info("이미 저장된 데이터가 있어서 예시 데이터를 가져오지 않았어요. 저장된 데이터를 다시 불러올게요.")
      void loadUserData()
    }
  }
  const steps = [
    {
      title: "노트에 정리해요",
      body: "강의 · 오답 · 시험 정리 중에 고르면 쓸 칸이 미리 잡혀 있어요.",
    },
    {
      title: "공부한 시간을 남겨요",
      body: "타이머를 켜 두거나, 끝나고 [기록 남기기]로 적어요.",
    },
    {
      title: "다시 볼 날에 복습해요",
      body: "노트의 답이 가려지고, 떠올린 만큼 다음 복습일이 정해져요.",
    },
  ]
  return (
    <section aria-labelledby="first-run-title" className="mb-8 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id="first-run-title" className="text-2xl font-semibold tracking-tight text-balance text-foreground">
        정리한 노트를 잊기 전에 다시 보게 해 줘요
      </h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 sm:flex-col sm:gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action-50 text-xs font-semibold text-action-700">
              {i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{step.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-pretty text-muted-foreground">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void start()} disabled={importing} className={button("primary")}>
          {importing && <Loader2 className="animate-spin" aria-hidden="true" />}
          {importing ? "예시를 넣는 중…" : "예시로 한 바퀴 둘러보기"}
        </button>
        <Link href="/new" className={button("secondary")}>
          빈 노트 만들기
        </Link>
      </div>
      <p className="mt-3 text-xs text-pretty text-muted-foreground">
        예시 노트와 기록이 내 계정에 들어가요. 다른 노트처럼 고치거나 지울 수 있어요.
      </p>
    </section>
  )
}
