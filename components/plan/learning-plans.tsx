"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { addDays, formatDuration, todayISO } from "@/lib/study-pages"
import {
  addPlan,
  decodeTarget,
  encodeTarget,
  removePlan,
  updatePlan,
  usePlanGoalsReady,
  usePlans,
  usePlanSlotsReady,
  type LearningPlan,
  type PlanSlot,
} from "@/lib/plans"
import { button } from "@/components/ui-styles"
import { groupPlans, type ActivePlan } from "@/lib/study-stats"
import { useWorkspace, type WorkspaceState } from "@/lib/workspace"
import { PlanCard } from "@/components/plan/plan-card"
import { PageHeader, SectionHeader, emptyState, primaryButton, secondaryButton } from "@/components/page-shell"
import { ConfirmDeleteModal } from "@/components/sidebar/confirm-delete-modal"

export function LearningPlans({ initialSubjectId }: { initialSubjectId?: string }) {
  const plans = usePlans()
  const workspace = useWorkspace()
  const today = useTodayISO()
  const [formOpen, setFormOpen] = useState(Boolean(initialSubjectId))
  const groups = today ? groupPlans(workspace, plans, today) : null

  return (
    <>
      <PageHeader
        title="학습 계획"
        actions={
          !formOpen && (
            <button type="button" onClick={() => setFormOpen(true)} className={primaryButton}>
              <Plus />
              계획 만들기
            </button>
          )
        }
      />
      <div className="flex flex-col gap-10">
        {formOpen && <PlanForm workspace={workspace} initialSubjectId={initialSubjectId} onClose={() => setFormOpen(false)} />}
        <section aria-labelledby="plans-title" className="flex flex-col gap-1">
          <SectionHeader id="plans-title" title="진행 중인 계획" count={groups ? groups.active.length : null} />
          {groups === null ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
          ) : groups.active.length > 0 ? (
            <PlanGrid items={groups.active} />
          ) : (
            <p className={emptyState}>
              {plans.length === 0 ? "아직 만든 계획이 없어요. 기간과 목표를 정해 두면 오늘 화면에서 진행 상황을 보여 줘요." : "지금 진행 중인 계획이 없어요."}
            </p>
          )}
        </section>
        {groups && groups.upcoming.length > 0 && <PlanGroup title="예정된 계획" items={groups.upcoming} />}
        {groups && groups.ended.length > 0 && <PlanGroup title="끝난 계획" items={groups.ended} />}
      </div>
    </>
  )
}

function PlanGroup({ title, items }: { title: string; items: ActivePlan[] }) {
  return (
    <section className="flex flex-col gap-1">
      <SectionHeader title={title} count={items.length} />
      <PlanGrid items={items} />
    </section>
  )
}

function PlanGrid({ items }: { items: ActivePlan[] }) {
  const workspace = useWorkspace()
  // Removing a plan can't be undone, so it asks first (same dialog as pages and records).
  const [removing, setRemoving] = useState<ActivePlan["plan"] | null>(null)
  // 계획 고치기 (2026-11-19): the form opens in place of the plan's row.
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <>
      <ul className="divide-y divide-border border-y border-border">
        {items.map((item) =>
          editing === item.plan.id ? (
            <li key={item.plan.id} className="py-4">
              <PlanForm
                workspace={workspace}
                editing={item.plan}
                onClose={() => {
                  setEditing(null)
                  // The form is gone: keyboard focus goes back to this plan's edit button.
                  setTimeout(() => document.getElementById(`plan-edit-${item.plan.id}`)?.focus(), 0)
                }}
              />
            </li>
          ) : (
            <PlanCard
              key={item.plan.id}
              item={item}
              onEdit={() => setEditing(item.plan.id)}
              onRemove={() => setRemoving(item.plan)}
            />
          ),
        )}
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

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]
const DURATIONS = [30, 60, 90, 120, 150, 180, 240]

type SlotDraft = { key: string; pageId: string; days: number[]; start: string; duration: number }

const toClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
const fromClock = (value: string) => {
  const [h, m] = value.split(":").map(Number)
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null
}

function PlanForm({
  workspace,
  initialSubjectId,
  editing,
  onClose,
}: {
  workspace: WorkspaceState
  initialSubjectId?: string
  // 계획 고치기: the plan to change (the form starts with its values and saves over it).
  editing?: LearningPlan
  onClose: () => void
}) {
  // Opened from 학습 분석 for one subject: that subject is the target and names the plan. An unknown id (deleted
  // subject, stale link) falls back to 전체 학습.
  const preset = workspace.groups.find((g) => g.kind === "subject" && g.id === initialSubjectId)
  const [title, setTitle] = useState(editing?.title ?? (preset ? `${preset.name} 다시 보기` : ""))
  const [target, setTarget] = useState(
    editing ? encodeTarget(editing.target) : preset ? encodeTarget({ scope: "subject", subjectId: preset.id }) : "all",
  )
  const [startDate, setStartDate] = useState(() => editing?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(() => editing?.endDate ?? addDays(todayISO(), 6))
  const [goal, setGoal] = useState(editing?.goal ?? "")
  const [goalHours, setGoalHours] = useState(editing?.goalMinutes ? String(editing.goalMinutes / 60) : "")
  const goalsReady = usePlanGoalsReady()
  const slotsReady = usePlanSlotsReady()
  const subjects = workspace.groups.filter((g) => g.kind === "subject")
  const pages = workspace.pages
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    (editing?.slots ?? []).map((s, i) => ({ key: `s${i}`, pageId: s.pageId, days: s.days, start: toClock(s.startMin), duration: s.durationMin })),
  )
  const [slotError, setSlotError] = useState<string | null>(null)

  // A new time row starts on the plan's own note, else the first note.
  const addSlot = () => {
    const decoded = decodeTarget(target)
    const pageId = decoded.scope === "page" ? decoded.pageId : (pages[0]?.id ?? "")
    setSlots((list) => [...list, { key: `n${Date.now()}`, pageId, days: [], start: "19:00", duration: 60 }])
    setSlotError(null)
  }
  const patchSlot = (key: string, patch: Partial<SlotDraft>) => {
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))
    setSlotError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const cleanSlots: PlanSlot[] = []
    for (const s of slots) {
      const startMin = fromClock(s.start)
      if (!s.pageId || s.days.length === 0 || startMin === null) {
        setSlotError("공부할 시각마다 노트, 요일, 시작 시각을 정해 주세요.")
        // Focus the row to fix (web-design-guidelines: focus the first error on submit).
        document.querySelector<HTMLElement>(`[data-slot="${s.key}"] ${s.days.length === 0 ? "button" : "input, select"}`)?.focus()
        return
      }
      cleanSlots.push({ pageId: s.pageId, days: [...s.days].sort(), startMin, durationMin: s.duration })
    }
    const fields = {
      title: title.trim(),
      target: decodeTarget(target),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      goal: goal.trim(),
      ...(goalsReady && Number(goalHours) > 0 ? { goalMinutes: Math.round(Number(goalHours) * 60) } : {}),
      ...(slotsReady && cleanSlots.length > 0 ? { slots: cleanSlots } : {}),
    }
    if (editing) updatePlan(editing.id, fields)
    else addPlan(fields)
    onClose()
  }

  const fieldClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-action-500"
  const smallField =
    "h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-action-500"

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={editing ? `${editing.title} 계획 고치기` : "새 계획"}
      className="grid gap-4 rounded-xl border border-action-200 bg-card p-5 sm:grid-cols-2"
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
          <optgroup label="노트">
            {pages.map((p) => (
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

      {/* 공부할 시각 (D-46): note + weekdays + time. Each one shows on the timetable on those days while the plan runs. */}
      {slotsReady && (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-medium text-card-foreground">공부할 시각 (선택)</legend>
          <p className="text-xs text-muted-foreground">
            노트마다 요일과 시각을 정하면, 계획 기간 동안 그 요일 시간표에 들어가요.
          </p>
          {slots.length > 0 && (
            <ul className="flex flex-col gap-2">
              {slots.map((slot, i) => (
                <li key={slot.key} data-slot={slot.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
                  <select
                    aria-label={`${i + 1}번째 시각의 노트`}
                    value={slot.pageId}
                    onChange={(e) => patchSlot(slot.key, { pageId: e.target.value })}
                    className={`${smallField} min-w-0 flex-1 basis-40`}
                  >
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || "제목 없음"}
                      </option>
                    ))}
                  </select>
                  <div role="group" aria-label={`${i + 1}번째 시각의 요일`} className="flex gap-0.5">
                    {DAY_NAMES.map((name, d) => {
                      const on = slot.days.includes(d)
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={on}
                          onClick={() => patchSlot(slot.key, { days: on ? slot.days.filter((x) => x !== d) : [...slot.days, d] })}
                          className={`touch-hit size-8 rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-500 ${
                            on ? "bg-action-600 text-action-foreground" : "bg-background text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="time"
                    step={600}
                    aria-label={`${i + 1}번째 시각의 시작`}
                    value={slot.start}
                    onChange={(e) => patchSlot(slot.key, { start: e.target.value })}
                    className={`${smallField} tabular-nums`}
                  />
                  <select
                    aria-label={`${i + 1}번째 시각의 길이`}
                    value={slot.duration}
                    onChange={(e) => patchSlot(slot.key, { duration: Number(e.target.value) })}
                    className={smallField}
                  >
                    {DURATIONS.map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSlots((list) => list.filter((s) => s.key !== slot.key))}
                    aria-label={`${i + 1}번째 시각 빼기`}
                    className={button("ghost", "icon-sm")}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" onClick={addSlot} disabled={pages.length === 0} className={button("secondary", "sm")}>
              <Plus aria-hidden="true" />
              시각 추가
            </button>
          </div>
          {slotError && (
            <p role="alert" className="text-xs text-danger-700">
              {slotError}
            </p>
          )}
        </fieldset>
      )}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          취소
        </button>
        <button type="submit" className={primaryButton}>
          {editing ? "고친 내용 저장" : "계획 만들기"}
        </button>
      </div>
    </form>
  )
}
