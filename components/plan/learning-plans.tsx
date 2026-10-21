"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarRange, Flag, Plus, X } from "lucide-react"
import { addDays, formatDate, todayISO } from "@/lib/study-pages"
import {
  addPlan,
  decodeTarget,
  encodeTarget,
  removePlan,
  usePlans,
  type PlanTarget,
} from "@/lib/plans"
import { useWorkspace, type WorkspaceState } from "@/lib/workspace"

function describeTarget(target: PlanTarget, { groups, pages }: WorkspaceState) {
  if (target.scope === "all") return { label: "전체 학습", href: null }
  if (target.scope === "subject") {
    const name = groups.find((g) => g.id === target.subjectId)?.name ?? "삭제된 과목"
    return { label: `과목 · ${name}`, href: `/subject/${target.subjectId}` }
  }
  const page = pages.find((p) => p.id === target.pageId)
  return {
    label: `페이지 · ${page ? page.title || "제목 없음" : "삭제된 페이지"}`,
    href: page ? `/record/${page.id}` : null,
  }
}

export function LearningPlans() {
  const plans = usePlans()
  const workspace = useWorkspace()
  const [formOpen, setFormOpen] = useState(false)

  return (
    <section aria-labelledby="plans-title" className="mb-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="plans-title" className="text-[15px] font-semibold text-foreground">
          진행 중인 계획
          <span className="ml-2 font-normal text-muted-foreground">{plans.length}</span>
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

      {plans.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const target = describeTarget(plan.target, workspace)
            return (
              <li
                key={plan.id}
                className="group relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-card-foreground">{plan.title}</h3>
                  <button
                    type="button"
                    onClick={() => removePlan(plan.id)}
                    aria-label={`${plan.title} 계획 삭제`}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {target.href ? (
                  <Link
                    href={target.href}
                    className="w-fit rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    {target.label}
                  </Link>
                ) : (
                  <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {target.label}
                  </span>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarRange className="size-3.5" />
                  {formatDate(plan.startDate)} ~ {formatDate(plan.endDate)}
                </p>
                {plan.goal && (
                  <p className="flex items-start gap-1.5 text-sm leading-relaxed text-foreground">
                    <Flag className="mt-1 size-3.5 shrink-0 text-indigo-600" />
                    {plan.goal}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        !formOpen && (
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
            아직 만든 계획이 없어요.
          </p>
        )
      )}
    </section>
  )
}

function PlanForm({ workspace, onClose }: { workspace: WorkspaceState; onClose: () => void }) {
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("all")
  const [startDate, setStartDate] = useState(() => todayISO())
  const [endDate, setEndDate] = useState(() => addDays(todayISO(), 6))
  const [goal, setGoal] = useState("")
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
      <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
        목표
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
