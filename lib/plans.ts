import { createStore } from "@/lib/create-store"
import { check, db, enqueueWrite } from "@/lib/db/queue"
import { newId, planInsertRow } from "@/lib/db/rows"

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

// Example plans for "예시 데이터 가져오기" (importExampleData in lib/workspace.ts). Targets are seed ids from
// lib/study-tree.ts / lib/study-pages.ts; the import maps them to the new uuids. Never loaded on their own.
export const examplePlans: LearningPlan[] = [
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

// The signed-in user's plans live in Supabase (learning_plans). This store is the screen cache: empty until
// lib/db/sync.ts loads it after sign-in.
const store = createStore<LearningPlan[]>([])

export const usePlans = store.useStore
export const getPlans = store.get

export function replacePlans(plans: LearningPlan[]) {
  store.set(() => plans)
}

export function addPlan(plan: Omit<LearningPlan, "id">) {
  const created: LearningPlan = { ...plan, id: newId() }
  store.set((plans) => [...plans, created])
  enqueueWrite(async (userId) => {
    check(await db().from("learning_plans").insert(planInsertRow(created, userId)).select("id"), 1)
  })
}

// Adds already-built plans (new ids, targets that exist) in one insert. Used by importExampleData.
export function insertPlans(created: LearningPlan[]) {
  if (created.length === 0) return
  store.set((plans) => [...plans, ...created])
  enqueueWrite(async (userId) => {
    const rows = created.map((p) => planInsertRow(p, userId))
    check(await db().from("learning_plans").insert(rows).select("id"), rows.length)
  })
}

// Deletes several plans in one write. Used when the node they target is deleted (lib/workspace.ts removeSubtree).
export function removePlans(ids: string[]) {
  const existing = new Set(store.get().filter((p) => ids.includes(p.id)).map((p) => p.id))
  if (existing.size === 0) return
  store.set((plans) => plans.filter((p) => !existing.has(p.id)))
  const targets = [...existing]
  enqueueWrite(async (userId) => {
    check(await db().from("learning_plans").delete().in("id", targets).eq("user_id", userId).select("id"), targets.length)
  })
}

// Undoable delete (lib/workspace.ts removeSubtree): take plans off the screen now, write the delete later.
export function detachPlans(ids: string[]) {
  const taken = store.get().filter((p) => ids.includes(p.id))
  if (taken.length > 0) store.set((plans) => plans.filter((p) => !ids.includes(p.id)))
  return taken
}

export function reattachPlans(plans: LearningPlan[]) {
  if (plans.length === 0) return
  store.set((current) => [...current, ...plans.filter((p) => !current.some((c) => c.id === p.id))])
}

// The DB half of detachPlans, run when the undo window closes. Same write as removePlans.
export async function deletePlanRows(ids: string[], userId: string) {
  if (ids.length === 0) return
  check(await db().from("learning_plans").delete().in("id", ids).eq("user_id", userId).select("id"), ids.length)
}

export function removePlan(id: string) {
  if (!store.get().some((p) => p.id === id)) return
  store.set((plans) => plans.filter((p) => p.id !== id))
  enqueueWrite(async (userId) => {
    check(await db().from("learning_plans").delete().eq("id", id).eq("user_id", userId).select("id"), 1)
  })
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
