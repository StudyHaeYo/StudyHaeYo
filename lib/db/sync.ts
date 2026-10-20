import { toast } from "sonner"
import { createStore } from "@/lib/create-store"
import { replacePlans } from "@/lib/plans"
import { replaceWorkspace } from "@/lib/workspace"
import { db, resetWrites, setCurrentUserId, setWriteFailureHandler } from "@/lib/db/queue"
import {
  NODE_COLUMNS,
  PLAN_COLUMNS,
  RECORD_COLUMNS,
  toPlan,
  toWorkspaceState,
  type NodeRow,
  type PlanRow,
  type RecordRow,
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

    const [nodes, records, plans] = await Promise.all([
      selectAll<NodeRow>("workspace_nodes", NODE_COLUMNS, userId, ["position", "created_at", "id"]),
      selectAll<RecordRow>("study_records", RECORD_COLUMNS, userId, ["study_date", "created_at", "id"]),
      selectAll<PlanRow>("learning_plans", PLAN_COLUMNS, userId, ["created_at", "id"]),
    ])
    if (seq !== loadSeq) return
    replaceWorkspace(
      toWorkspaceState(nodes, records),
      new Map(nodes.map((n) => [n.id, { parentId: n.parent_id, position: n.position }])),
    )
    replacePlans(plans.map(toPlan))
    statusStore.set(() => ({ phase: "ready" }))
  } catch (error) {
    if (seq !== loadSeq) return
    statusStore.set(() => ({ phase: "error", message: messageOf(error) }))
  }
}

// Clears everything the previous user left in memory: cached data, pending writes, and the user id.
function clearUserData() {
  loadSeq += 1
  resetWrites()
  setCurrentUserId(null)
  replaceWorkspace(null)
  replacePlans([])
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
