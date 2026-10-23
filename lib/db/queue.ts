import type { PostgrestError } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

// Browser-side write path for workspace/plan data. Components never call this; lib/workspace.ts and lib/plans.ts do.
// The user id always comes from the verified auth user (see lib/db/sync.ts), never from component input,
// and RLS on every table is the final check.

let client: ReturnType<typeof createClient> | null = null
export function db() {
  client ??= createClient()
  return client
}

let userId: string | null = null
export const currentUserId = () => userId
export function setCurrentUserId(id: string | null) {
  userId = id
}

// Writes run one at a time in call order, so a page is inserted before its records and a parent before its child.
// After one write fails, the rest of that batch is dropped and the failure handler reloads from the DB.
let tail: Promise<void> = Promise.resolve()
let generation = 0
let inFlight = 0
let onFailure: ((error: unknown) => void) | null = null

export function setWriteFailureHandler(handler: (error: unknown) => void) {
  onFailure = handler
}

export function enqueueWrite(task: (userId: string) => Promise<void>) {
  const gen = generation
  inFlight += 1
  tail = tail.then(async () => {
    try {
      if (gen !== generation) return
      if (!userId) throw new Error("로그인 정보가 없어요. 다시 로그인해 주세요.")
      await task(userId)
    } catch (error) {
      if (gen !== generation) return
      resetWrites()
      onFailure?.(error)
    } finally {
      inFlight -= 1
    }
  })
}

// Debounced patches (typing in titles and page bodies). Patches for the same key merge until they are sent.
interface Scheduled {
  patch: object
  run: (patch: object, userId: string) => Promise<void>
  timer?: ReturnType<typeof setTimeout>
}
const scheduled = new Map<string, Scheduled>()

export function schedulePatch<P extends object>(
  key: string,
  patch: P,
  run: (patch: P, userId: string) => Promise<void>,
  delayMs: number,
) {
  const prev = scheduled.get(key)
  if (prev?.timer) clearTimeout(prev.timer)
  const entry: Scheduled = { patch: { ...prev?.patch, ...patch }, run: run as Scheduled["run"] }
  scheduled.set(key, entry)
  if (delayMs <= 0) flushPatch(key)
  else entry.timer = setTimeout(() => flushPatch(key), delayMs)
}

function flushPatch(key: string) {
  const entry = scheduled.get(key)
  if (!entry) return
  if (entry.timer) clearTimeout(entry.timer)
  scheduled.delete(key)
  enqueueWrite((uid) => entry.run(entry.patch, uid))
}

export function flushScheduledWrites() {
  for (const key of [...scheduled.keys()]) flushPatch(key)
}

// Sends one pending patch now (if any), e.g. a node's unsaved title before the node is deleted.
export function flushScheduledKey(key: string) {
  flushPatch(key)
}

// Cancels a pending write and says whether it was still waiting (false = already sent, too late to undo).
export function cancelScheduled(key: string) {
  const entry = scheduled.get(key)
  if (!entry) return false
  if (entry.timer) clearTimeout(entry.timer)
  scheduled.delete(key)
  return true
}

// Drops a pending patch for something that is about to be deleted.
export function dropScheduled(key: string) {
  const entry = scheduled.get(key)
  if (entry?.timer) clearTimeout(entry.timer)
  scheduled.delete(key)
}

export function hasUnsavedWrites() {
  return scheduled.size > 0 || inFlight > 0
}

// Sends pending patches now and resolves once every queued write has finished (or been dropped).
export async function settleWrites() {
  flushScheduledWrites()
  while (inFlight > 0) await tail
}

// Cancels everything not yet sent. Used on sign-out, user switch, and after a failed write.
export function resetWrites() {
  generation += 1
  for (const entry of scheduled.values()) if (entry.timer) clearTimeout(entry.timer)
  scheduled.clear()
}

// Supabase reports a write that RLS filtered out as success with zero rows; treat that as a failure
// so the UI never shows a save that didn't happen.
export function check<T>(result: { data: T[] | null; error: PostgrestError | null }, expected: number) {
  if (result.error) throw result.error
  if ((result.data?.length ?? 0) !== expected) throw new Error("저장 대상이 없거나 접근 권한이 없어요.")
}
