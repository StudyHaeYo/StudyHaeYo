import { toast } from "sonner"
import { createStore } from "@/lib/create-store"
import { replacePlans, setPlanGoalsReady } from "@/lib/plans"
import { replaceWorkspace, setPagePropsReady, setSubjectRecordsReady } from "@/lib/workspace"
import { replaceTodos } from "@/lib/todos"
import { db, resetWrites, setCurrentUserId, setWriteFailureHandler } from "@/lib/db/queue"
import {
  LEGACY_PLAN_COLUMNS,
  LEGACY_NODE_COLUMNS,
  LEGACY_RECORD_COLUMNS,
  NODE_COLUMNS,
  PLAN_COLUMNS,
  RECORD_COLUMNS,
  TODO_COLUMNS,
  toPlan,
  toTodo,
  toWorkspaceState,
  type NodeRow,
  type PlanRow,
  type RecordRow,
  type TodoRow,
} from "@/lib/db/rows"

export type DataStatus = { phase: "loading" } | { phase: "ready" } | { phase: "error"; message: string }

// Server snapshot and first client render are both "loading", so hydration matches (R8).
const statusStore = createStore<DataStatus>({ phase: "loading" })
export const useDataStatus = statusStore.useStore

const PAGE_SIZE = 1000

// PostgREST returns at most 1000 rows per request; read every page of the user's rows.
async function selectAll<T>(table: string, columns: string, userId: string, orderBy: string[]) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db().from(table).select(columns).eq("user_id", userId)
    for (const column of orderBy) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error)
}

let loadSeq = 0

// workspace_nodes without the props column (20261031_page_props.sql not applied): load without it and hide
// template-specific features (D-27).
async function selectNodes(userId: string) {
  try {
    const rows = await selectAll<NodeRow>("workspace_nodes", NODE_COLUMNS, userId, ["position", "created_at", "id"])
    return { rows, props: true }
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "42703") throw error
    const rows = await selectAll<NodeRow>("workspace_nodes", LEGACY_NODE_COLUMNS, userId, ["position", "created_at", "id"])
    return { rows, props: false }
  }
}

// Same for learning_plans.goal_minutes.
async function selectPlans(userId: string) {
  try {
    const rows = await selectAll<PlanRow>("learning_plans", PLAN_COLUMNS, userId, ["created_at", "id"])
    return { rows, goals: true }
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "42703") throw error
    const rows = await selectAll<PlanRow>("learning_plans", LEGACY_PLAN_COLUMNS, userId, ["created_at", "id"])
    return { rows, goals: false }
  }
}

// study_records without the subject_id column (migration not applied yet): load page records only and turn off
// subject records, instead of failing the whole load.
async function selectRecords(userId: string) {
  try {
    const rows = await selectAll<RecordRow>("study_records", RECORD_COLUMNS, userId, ["study_date", "created_at", "id"])
    return { rows, subjectRecords: true }
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== "42703") throw error
    const rows = await selectAll<RecordRow>("study_records", LEGACY_RECORD_COLUMNS, userId, ["study_date", "created_at", "id"])
    return { rows, subjectRecords: false }
  }
}

// Loads the signed-in user's workspace and plans. The user id comes from getUser(), which the auth server verifies.
export async function loadUserData() {
  const seq = ++loadSeq
  statusStore.set(() => ({ phase: "loading" }))
  try {
    const { data, error } = await db().auth.getUser()
    if (seq !== loadSeq) return
    if (error || !data.user) throw error ?? new Error("로그인 정보를 확인하지 못했어요.")
    const userId = data.user.id
    setCurrentUserId(userId)

    const [{ rows: nodes, props }, records, plans] = await Promise.all([
      selectNodes(userId),
      selectRecords(userId),
      selectPlans(userId),
    ])
    if (seq !== loadSeq) return
    setSubjectRecordsReady(records.subjectRecords)
    setPagePropsReady(props)
    replaceWorkspace(
      toWorkspaceState(nodes, records.rows),
      new Map(nodes.map((n) => [n.id, { parentId: n.parent_id, position: n.position }])),
    )
    setPlanGoalsReady(plans.goals)
    replacePlans(plans.rows.map(toPlan))
    statusStore.set(() => ({ phase: "ready" }))
    void loadTodos(userId, seq)
  } catch (error) {
    if (seq !== loadSeq) return
    statusStore.set(() => ({ phase: "error", message: messageOf(error) }))
  }
}

// Todos load separately so a missing todos table (not created yet) only turns the checklist off, not the app.
async function loadTodos(userId: string, seq: number) {
  try {
    const rows = await selectAll<TodoRow>("todos", TODO_COLUMNS, userId, ["position", "created_at", "id"])
    if (seq === loadSeq) replaceTodos(rows.map(toTodo), "ready")
  } catch {
    if (seq === loadSeq) replaceTodos([], "unavailable")
  }
}

// Clears everything the previous user left in memory: cached data, pending writes, and the user id.
function clearUserData() {
  loadSeq += 1
  resetWrites()
  setCurrentUserId(null)
  replaceWorkspace(null)
  replacePlans([])
  replaceTodos([], "loading")
  statusStore.set(() => ({ phase: "loading" }))
}

setWriteFailureHandler((error) => {
  toast.error(`변경 내용을 저장하지 못했어요. 저장된 내용으로 다시 불러올게요. (${messageOf(error)})`)
  void loadUserData()
})

let loadedFor: string | null = null

// Follows the auth session: loads on sign-in, clears on sign-out, and reloads when a different user signs in
// in the same tab, so one user's data never stays on screen for another.
export function startDataSync() {
  let client: ReturnType<typeof db>
  try {
    client = db()
  } catch (error) {
    // Missing Supabase env vars: show the error instead of breaking every page.
    statusStore.set(() => ({ phase: "error", message: messageOf(error) }))
    return () => {}
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null
    // Supabase calls this inside its auth lock; run follow-up auth calls (getUser) outside it.
    setTimeout(() => {
      if (userId === loadedFor) return
      clearUserData()
      loadedFor = userId
      if (userId) void loadUserData()
    }, 0)
  })
  return () => data.subscription.unsubscribe()
}
