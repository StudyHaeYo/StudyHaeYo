"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { addDays, todayISO } from "@/lib/study-pages"
import { addPlan, decodeTarget, encodeTarget, removePlan, usePlanGoalsReady, usePlans } from "@/lib/plans"
import { groupPlans, type ActivePlan } from "@/lib/study-stats"
import { useWorkspace, type WorkspaceState } from "@/lib/workspace"
import { PlanCard } from "@/components/plan/plan-card"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"

export function LearningPlans() {
  const plans = usePlans()
  const workspace = useWorkspace()
  const today = useTodayISO()
  const [formOpen, setFormOpen] = useState(false)
  const groups = today ? groupPlans(workspace, plans, today) : null

  return (
    <section aria-labelledby="plans-title" className="mb-8 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="plans-title" className="text-[15px] font-semibold text-foreground">
            진행 중인 계획
            {groups && <span className="ml-2 font-normal text-muted-foreground">{groups.active.length}</span>}
          </h2>
          {!formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              계획 만들기
            </button>
          )}
        </div>

        {formOpen && <PlanForm workspace={workspace} onClose={() => setFormOpen(false)} />}

        {groups === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
        ) : groups.active.length > 0 ? (
          <PlanGrid items={groups.active} />
        ) : (
          !formOpen && (
            <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
              {plans.length === 0 ? "아직 만든 계획이 없어요. 기간과 목표를 정해 두면 홈에서 진행 상황을 보여 줘요." : "지금 진행 중인 계획이 없어요."}
            </p>
          )
        )}
      </div>

      {groups && groups.upcoming.length > 0 && <PlanGroup title="예정된 계획" items={groups.upcoming} />}
      {groups && groups.ended.length > 0 && <PlanGroup title="끝난 계획" items={groups.ended} />}
    </section>
  )
}

function PlanGroup({ title, items }: { title: string; items: ActivePlan[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{items.length}</span>
      </h2>
      <PlanGrid items={items} />
    </div>
  )
}

function PlanGrid({ items }: { items: ActivePlan[] }) {
  // Removing a plan can't be undone, so it asks first (same dialog as pages and records).
  const [removing, setRemoving] = useState<ActivePlan["plan"] | null>(null)
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <PlanCard key={item.plan.id} item={item} onRemove={() => setRemoving(item.plan)} />
        ))}
      </ul>
      <ConfirmDeleteModal
        open={removing !== null}
        title={removing?.title ?? ""}
        targetLabel="계획"
        note="계획만 지워지고, 그동안 남긴 학습 기록은 그대로 남아요."
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removePlan(removing.id)
          setRemoving(null)
        }}
      />
    </>
  )
}

function PlanForm({ workspace, onClose }: { workspace: WorkspaceState; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("all")
  const [startDate, setStartDate] = useState(() => todayISO())
  const [endDate, setEndDate] = useState(() => addDays(todayISO(), 6))
  const [goal, setGoal] = useState("")
  const [goalHours, setGoalHours] = useState("")
  const goalsReady = usePlanGoalsReady()
  const subjects = workspace.groups.filter((g) => g.kind === "subject")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addPlan({
      title: title.trim(),
      target: decodeTarget(target),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      goal: goal.trim(),
      ...(goalsReady && Number(goalHours) > 0 ? { goalMinutes: Math.round(Number(goalHours) * 60) } : {}),
    })
    onClose()
  }

  const fieldClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-indigo-500"

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-xl border border-indigo-200 bg-card p-5 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        계획 제목
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 이번 주 전공 공부"
          required
          autoFocus
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        대상
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={fieldClass}>
          <option value="all">전체 학습</option>
          <optgroup label="과목">
            {subjects.map((s) => (
              <option key={s.id} value={encodeTarget({ scope: "subject", subjectId: s.id })}>
                {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="페이지">
            {workspace.pages.map((p) => (
              <option key={p.id} value={encodeTarget({ scope: "page", pageId: p.id })}>
                {p.title || "제목 없음"}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
          시작일
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
          종료일
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      {goalsReady && (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
          목표 시간 (선택)
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value)}
              placeholder="예: 10"
              className={fieldClass}
            />
            <span className="shrink-0 font-normal text-muted-foreground">시간</span>
          </span>
          <span className="text-xs font-normal text-muted-foreground">정하면 진행 막대가 이 시간 대비로 채워져요.</span>
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        목표 메모
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="예: 3시간 공부, 문제 20개 풀기"
          className={fieldClass}
        />
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          계획 생성
        </button>
      </div>
    </form>
  )
}
