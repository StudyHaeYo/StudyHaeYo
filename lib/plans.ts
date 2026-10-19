import { createStore } from "@/lib/create-store"

// A plan can cover all study, one subject, or one page — it never has to pick a leaf page.
export type PlanTarget =
  | { scope: "all" }
  | { scope: "subject"; subjectId: string }
  | { scope: "page"; pageId: string }

export interface LearningPlan {
  id: string
  title: string
  target: PlanTarget
  startDate: string
  endDate: string
  goal: string
}

const seedPlans: LearningPlan[] = [
  {
    id: "plan-1",
    title: "이번 주 전공 공부",
    target: { scope: "all" },
    startDate: "2026-09-28",
    endDate: "2026-10-04",
    goal: "주 10시간 공부",
  },
  {
    id: "plan-2",
    title: "자료구조 집중",
    target: { scope: "subject", subjectId: "ds" },
    startDate: "2026-09-28",
    endDate: "2026-10-04",
    goal: "자료구조 3시간 공부",
  },
  {
    id: "plan-3",
    title: "해시 테이블 복습",
    target: { scope: "page", pageId: "ds-1" },
    startDate: "2026-09-30",
    endDate: "2026-10-01",
    goal: "충돌 처리 복습 후 학습 기록 남기기",
  },
]

const store = createStore<LearningPlan[]>(seedPlans)

export const usePlans = store.useStore
export const getPlans = store.get

export function addPlan(plan: Omit<LearningPlan, "id">) {
  store.set((plans) => [...plans, { ...plan, id: `plan-${Date.now().toString(36)}` }])
}

export function removePlan(id: string) {
  store.set((plans) => plans.filter((p) => p.id !== id))
}

// A subject with plans pointing at it can't become a folder, or those plans would lose their target.
export function plansTargetingSubject(plans: LearningPlan[], subjectId: string) {
  return plans.filter((p) => p.target.scope === "subject" && p.target.subjectId === subjectId)
}

export function encodeTarget(target: PlanTarget) {
  if (target.scope === "all") return "all"
  return target.scope === "subject" ? `subject:${target.subjectId}` : `page:${target.pageId}`
}

export function decodeTarget(value: string): PlanTarget {
  const [scope, id] = value.split(":")
  if (scope === "subject" && id) return { scope: "subject", subjectId: id }
  if (scope === "page" && id) return { scope: "page", pageId: id }
  return { scope: "all" }
}
