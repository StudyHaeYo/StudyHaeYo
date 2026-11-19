"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, CalendarRange, ChevronDown, Loader2, Plus, RotateCcw, Target } from "lucide-react"
import { toast } from "sonner"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates, reviewHref, type StudyCandidate } from "@/lib/study-candidates"
import { dueToneClass, formatDuration } from "@/lib/study-pages"
import { activePlans, isPlanTodo, planToday, type ActivePlan } from "@/lib/study-stats"
import { usePlans } from "@/lib/plans"
import { importExampleData, useWorkspace } from "@/lib/workspace"
import { loadUserData, useDataStatus } from "@/lib/db/sync"
import { TodayTimetable } from "@/components/learning-os/today-timetable"
import { UnresolvedBadge } from "@/components/study-page/unresolved-badge"
import { ChecklistBody } from "@/components/checklist-widget"
import { TimePicker } from "@/components/time-picker"
import { button } from "@/components/ui-styles"
import { MIN_DRAWN_MINUTES } from "@/lib/timetable"
import { useTimeSlots } from "@/lib/time-slots"
import { addTodo, todayChecklist, useTodos, useTodosStatus } from "@/lib/todos"
import { RuledHeader } from "@/components/page-shell"

const REVIEW_LIMIT = 3

type Focus = { kind: "review"; item: StudyCandidate } | { kind: "plan"; item: ActivePlan } | null

// 오늘 (재설계 D-43): one thing to do now, then the rest of the day in one list.
// - 지금 할 것: the most urgent review (exam range first, D-31), or else what a running plan asks of today. It holds
//   the screen's one filled button (D-40), so "where do I start" has one answer. It is left out of the list below.
// - 하루 할 일: the other reviews, the plans' shares and the to-dos in one row shape. [목록 | 시간표] shows the same day
//   as a list or on the time grid (D-38) — one place instead of a list beside a grid repeating the same to-dos.
// - A brand-new account gets the first visit instead (FirstRun): the loop in three steps and [예시로 한 바퀴].
// Rendered as two grid items with the page's `between` in the middle (공부 타이머), so the order on a phone and the
// keyboard order are the same: what to do, how to start, the rest of the day.
export function TodayAgenda({
  nowClassName = "",
  listClassName = "",
  between,
}: {
  nowClassName?: string
  listClassName?: string
  between?: ReactNode
}) {
  const workspace = useWorkspace()
  const plans = usePlans()
  const today = useTodayISO()
  const todos = useTodos()
  const status = useDataStatus()
  const { todoTimes, recordTimes } = useTimeSlots()
  const [view, setView] = useState<"list" | "time">("list")
  // Set by [예시로 한 바퀴]: the first review card then says what a review is, once, for this visit.
  const [tour, setTour] = useState(false)
  const reviews = today ? reviewCandidates(workspace, today) : null
  const running = today ? activePlans(workspace, plans, today) : null
  // Before the todos table exists the checklist can't save anything, so it stays out of sight.
  const checklistAvailable = useTodosStatus() !== "unavailable"
  const checklist = today ? todayChecklist(todos, today) : []
  const scheduled = (item: ActivePlan) => checklist.some((t) => isPlanTodo(t.title, item.plan.title))
  // A plan still asks for something today while it has a share and that share isn't a to-do yet.
  const plansLeft = (running ?? []).filter((item) => planToday(item) && !scheduled(item))
  const focus: Focus = reviews?.[0] ? { kind: "review", item: reviews[0] } : plansLeft[0] ? { kind: "plan", item: plansLeft[0] } : null
  const restReviews = (reviews ?? []).filter((r) => !(focus?.kind === "review" && focus.item.pageId === r.pageId))
  const restPlans = (running ?? []).filter((p) => !(focus?.kind === "plan" && focus.item.plan.id === p.plan.id))
  // What the list below still holds (지금 할 것 is counted there, not here).
  const left = (reviews?.length ?? 0) + plansLeft.length + checklist.filter((t) => t.doneAt === null).length - (focus ? 1 : 0)
  const firstVisit = status.phase === "ready" && workspace.pages.length === 0 && workspace.subjectRecords.length === 0
  const loading = today === null || reviews === null || running === null

  return (
    <>
      <div className={nowClassName}>
        {firstVisit ? (
          <FirstRun onImported={() => setTour(true)} />
        ) : loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
        ) : (
          <NowCard focus={focus} today={today} canTime={todoTimes} tour={tour} next={restReviews[0]?.topic ?? null} />
        )}
      </div>

      {between}

      <section aria-labelledby="today-agenda-title" className={listClassName}>
        <RuledHeader
          id="today-agenda-title"
          title={firstVisit || focus === null ? "하루 할 일" : "그다음 할 일"}
          aside={
            <span className="flex items-center gap-3">
              {!loading && left > 0 && <span className="tabular-nums">{`${left}개 남음`}</span>}
              {/* One way into 계획: its list and [계획 만들기] are both on /plan. */}
              <Link href="/plan" className="inline-flex items-center gap-1 font-medium text-action-700 hover:underline">
                <CalendarRange className="size-3.5" aria-hidden="true" />
                계획
              </Link>
            </span>
          }
        />
        {(todoTimes || recordTimes) && (
          <div role="group" aria-label="하루 할 일 보기" className="mb-2 mt-2 inline-flex rounded-lg bg-muted p-0.5 text-xs">
            {(["list", "time"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className="touch-hit rounded-md px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-500 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {v === "list" ? "목록" : "시간표"}
              </button>
            ))}
          </div>
        )}

        {view === "time" ? (
          <TodayTimetable bare />
        ) : (
          <>
            {loading ? (
              <Skeleton />
            ) : (
              <>
                {restReviews.length > 0 && <ReviewList reviews={restReviews} />}
                {restPlans.length > 0 && (
                  <ul className="flex flex-col gap-0.5">
                    {restPlans.map((item) => (
                      <PlanRow key={item.plan.id} item={item} today={today} canTime={todoTimes} scheduled={scheduled(item)} />
                    ))}
                  </ul>
                )}
              </>
            )}
            {checklistAvailable && (
              <div className="mt-0.5">
                <ChecklistBody />
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}

// A note with no record yet (an AI-made 오답 노트, D-32) has no "last studied" day to show.
function studiedText(item: StudyCandidate) {
  return item.lastStudied === null ? "아직 공부 기록 없음" : `마지막 학습 ${item.lastStudied}`
}

// 지금 할 것: one item, large, with the screen's one filled button.
function NowCard({ focus, today, canTime, tour, next }: { focus: Focus; today: string; canTime: boolean; tour: boolean; next: string | null }) {
  // After [예시로 한 바퀴] the button that was pressed is gone; keyboard focus goes to where the tour says to start.
  const startRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (tour) startRef.current?.focus()
  }, [tour])
  if (focus === null) {
    return (
      <section aria-labelledby="now-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">지금 할 것</p>
        <h2 id="now-title" className="mt-1 text-xl font-semibold tracking-tight text-balance text-foreground">
          복습할 노트도, 계획의 오늘 몫도 다 했어요
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">할 일을 마저 하거나, 오늘 공부한 내용을 노트로 남겨 보세요.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/new" className={button("secondary")}>
            <Plus aria-hidden="true" />새 노트
          </Link>
        </div>
      </section>
    )
  }

  if (focus.kind === "review") {
    const { item } = focus
    const late = item.dueTone === "overdue"
    return (
      <section aria-labelledby="now-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-action-700">
          지금 할 것 · 복습
          {late && (
            <span className="inline-flex items-center gap-1.5 font-normal text-attention-700">
              <span className="size-1.5 rounded-full bg-attention-500" aria-hidden="true" />
              다시 볼 때예요
            </span>
          )}
          {item.exam && <span className="font-normal text-muted-foreground">{`시험 ${item.exam}`}</span>}
        </p>
        <h2 id="now-title" className="mt-1 text-2xl font-semibold tracking-tight text-balance text-foreground">
          {item.topic}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {item.subject} · {studiedText(item)}
          {item.understanding !== null ? ` · 이해도 ${item.understanding}/5` : ""}
          {item.unresolvedConfusions > 0 && <span className="font-medium text-attention-700">{` · 헷갈린 점 ${item.unresolvedConfusions}개 남음`}</span>}
          {item.wrongProblems > 0 && ` · 틀린 문제 ${item.wrongProblems}`}
        </p>
        {tour && (
          <p className="mt-4 rounded-lg bg-action-50 px-3 py-2.5 text-sm leading-relaxed text-pretty text-foreground">
            여기서 시작해 보세요. [{item.action}]를 누르면 노트의 답이 회색으로 가려져요. 떠올려 본 뒤 펼쳐서 알았음 · 헷갈림 ·
            몰랐음을 고르면, 그 결과로 다음 복습일이 정해져요.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link ref={startRef} href={reviewHref(item.pageId)} className={button("primary")}>
            {item.action}
            <ArrowRight aria-hidden="true" />
          </Link>
          {next && <span className="min-w-0 truncate text-sm text-muted-foreground">{`다음: ${next}`}</span>}
        </div>
      </section>
    )
  }

  const { item } = focus
  const ask = planToday(item)!
  const left = item.daysLeft === 0 ? "오늘 마감" : `${item.daysLeft}일 남음`
  const progress = item.plan.goalMinutes ? `${formatDuration(item.studiedMinutes)} / ${formatDuration(item.plan.goalMinutes)}` : formatDuration(item.studiedMinutes)
  const picker = canTime && (
    <TimePicker
      startMin={null}
      durationMin={null}
      onChange={(start) => start !== null && addTodo(ask.title, today, start, ask.minutes === null ? null : Math.max(MIN_DRAWN_MINUTES, ask.minutes))}
      withDuration={false}
      closeOnPick
      label={`${item.plan.title} 시간 정하기`}
      className={() => button(item.targetHref ? "secondary" : "primary")}
    >
      시간 정하기
    </TimePicker>
  )
  return (
    <section aria-labelledby="now-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <p className="text-sm font-medium text-action-700">지금 할 것 · 계획</p>
      <h2 id="now-title" className="mt-1 text-2xl font-semibold tracking-tight text-balance text-foreground">
        {item.plan.title}
        {ask.minutes ? <span className="ml-2 text-lg font-medium text-action-700">{`오늘 ${formatDuration(ask.minutes)}`}</span> : null}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {`${item.targetLabel} · ${progress} · `}
        <span className={item.daysLeft <= 1 ? "font-medium text-attention-700" : ""}>{left}</span>
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {item.targetHref && (
          <Link href={item.targetHref} className={button("primary")}>
            공부하러 가기
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
        {picker}
      </div>
    </section>
  )
}

// A new account: what the app does, as the loop it runs, and a way to try it before writing anything.
function FirstRun({ onImported }: { onImported: () => void }) {
  const [importing, setImporting] = useState(false)
  const start = async () => {
    setImporting(true)
    const result = await importExampleData()
    setImporting(false)
    if (result === "imported") onImported()
    else if (result === "not-empty") {
      // The DB already has rows this screen hasn't loaded (another tab); show them instead of importing.
      toast.info("이미 저장된 데이터가 있어서 예시 데이터를 가져오지 않았어요. 저장된 데이터를 다시 불러올게요.")
      void loadUserData()
    }
  }
  const steps = [
    { title: "노트에 정리해요", body: "수업 · 문제집 · 시험 범위를 노트로. 강의 · 오답 · 시험 정리 모양도 있어요." },
    { title: "공부한 시간을 남겨요", body: "타이머를 켜 두거나, 끝나고 [기록 남기기]로 적어요." },
    { title: "다시 볼 날에 복습해요", body: "노트의 답이 가려지고, 떠올린 만큼 다음 복습일이 정해져요." },
  ]
  return (
    <section aria-labelledby="first-run-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <p className="text-sm font-medium text-action-700">처음 오셨나요</p>
      <h2 id="first-run-title" className="mt-1 text-2xl font-semibold tracking-tight text-balance text-foreground">
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
              <span className="mt-0.5 block text-sm leading-relaxed text-pretty text-muted-foreground">{step.body}</span>
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
          빈 노트로 시작
        </Link>
      </div>
      <p className="mt-3 text-xs text-pretty text-muted-foreground">
        예시 노트와 기록이 내 계정에 들어가요. 다른 노트처럼 고치거나 지울 수 있어요.
      </p>
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

function ReviewRow({ item }: { item: StudyCandidate }) {
  return (
    <li>
      <Link
        href={reviewHref(item.pageId)}
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
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
            {item.subject} · {studiedText(item)}
            {item.understanding !== null ? ` · 이해도 ${item.understanding}/5` : ""}
          </span>
        </span>
        {/* Every row here is due now, so "다시 볼 때예요" / "오늘" would repeat the section's name on each line. Only a
            row that is not yet due (tomorrow's) says when. */}
        {item.dueTone !== "overdue" && item.dueTone !== "today" && (
          <span className={`shrink-0 text-xs font-medium ${dueToneClass[item.dueTone]}`}>{item.due}</span>
        )}
        {/* Rows say what they do quietly; where to start is the 지금 할 것 card above (D-40, D-43). */}
        <span className="shrink-0 text-xs font-medium text-muted-foreground group-hover:text-foreground">
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
        {shown.map((item) => (
          <ReviewRow key={item.pageId} item={item} />
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
