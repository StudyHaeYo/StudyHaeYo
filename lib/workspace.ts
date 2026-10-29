import { toast } from "sonner"
import { createStore } from "@/lib/create-store"
import {
  addDays,
  cloneBlock,
  daysBetween,
  studyPages,
  todayISO,
  type PageStudyRecord,
  type StudyPage,
  type SubjectStudyRecord,
} from "@/lib/study-pages"
import { studyTree } from "@/lib/study-tree"
import { getStarter, isStudyOn } from "@/lib/templates"
import {
  deletePlanRows,
  detachPlans,
  examplePlans,
  getPlans,
  insertPlans,
  plansTargetingSubject,
  reattachPlans,
  type LearningPlan,
} from "@/lib/plans"
import {
  cancelScheduled,
  check,
  currentUserId,
  db,
  enqueueWrite,
  flushScheduledKey,
  schedulePatch,
} from "@/lib/db/queue"
import {
  changedPageColumns,
  DEBOUNCED_PAGE_COLUMNS,
  groupInsertRow,
  newId,
  pageInsertRow,
  recordInsertRow,
  recordUpdateRow,
  subjectRecordInsertRow,
} from "@/lib/db/rows"

// A folder groups pages or other groups; a subject is a group that plans and analytics can target.
export type GroupKind = "folder" | "subject"

export interface WorkspaceGroup {
  id: string
  name: string
  parentId: string | null
  kind: GroupKind
}

export interface WorkspaceState {
  groups: WorkspaceGroup[]
  pages: StudyPage[]
  // Records of studying without a page, attached to a subject (D-24). Page records stay in page.studyRecords.
  subjectRecords: SubjectStudyRecord[]
  // Sibling order for groups and pages alike; ids missing here sort after listed ones.
  order: string[]
}

// The signed-in user's workspace lives in Supabase (workspace_nodes + study_records). This store is the screen cache:
// it starts empty (server snapshot too, so hydration matches), lib/db/sync.ts fills it after sign-in, and every
// function below updates it first and then queues the matching DB write. A failed write reloads from the DB.
// The seed pages in lib/study-tree.ts and lib/study-pages.ts are no longer loaded here.
const emptyWorkspace: WorkspaceState = { groups: [], pages: [], subjectRecords: [], order: [] }
const store = createStore<WorkspaceState>(emptyWorkspace)

export const useWorkspace = store.useStore

// False while study_records has no subject_id column (supabase/migrations/20261024_subject_records.sql not
// applied): then a record must go on a page. Server snapshot is true so the first render matches.
const subjectRecordsReadyStore = createStore<boolean>(true)
export const useSubjectRecordsReady = subjectRecordsReadyStore.useStore
export function setSubjectRecordsReady(ready: boolean) {
  subjectRecordsReadyStore.set(() => ready)
}

// Last (parentId, position) written to workspace_nodes for each node, so only moved siblings get updated.
let savedPositions = new Map<string, { parentId: string | null; position: number }>()

// `positions` are the (parent_id, position) values as stored in the DB. The next tree change rewrites any sibling
// whose stored value differs from its place on screen, so gaps or duplicate positions get normalized.
export function replaceWorkspace(
  state: WorkspaceState | null,
  positions: Map<string, { parentId: string | null; position: number }> = new Map(),
) {
  savedPositions = new Map(positions)
  store.set(() => (state ? inTreeOrder(state) : emptyWorkspace))
}

// Rows arrive sorted by position across all depths. Home and analytics widgets list subjects and pages in array
// order, so put the arrays in sidebar (depth-first) order, the same order the in-memory seed had.
function inTreeOrder(state: WorkspaceState): WorkspaceState {
  const rank = new Map(flattenTree(state).map((e, i) => [e.node.id, i]))
  const byRank = (a: { id: string }, b: { id: string }) =>
    (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  return { ...state, groups: [...state.groups].sort(byRank), pages: [...state.pages].sort(byRank) }
}

const DEBOUNCE_MS = 600

function siblingPositions(tree: TreeSource) {
  const result = new Map<string, { parentId: string | null; position: number }>()
  const parents = new Set<string | null>([null, ...tree.groups.map((g) => g.parentId), ...tree.pages.map((p) => p.parentId)])
  for (const parentId of parents) {
    childNodes(tree, parentId).forEach((child, position) => {
      result.set(child.type === "group" ? child.group.id : child.page.id, { parentId, position })
    })
  }
  return result
}

function positionOf(id: string) {
  const position = siblingPositions(store.get()).get(id)?.position ?? 0
  savedPositions.set(id, { parentId: findNode(store.get(), id)?.parentId ?? null, position })
  return position
}

// Writes parent/position for every node whose place among its siblings changed.
function syncPositions() {
  const next = siblingPositions(store.get())
  const changed: { id: string; parentId: string | null; position: number }[] = []
  for (const [id, place] of next) {
    const saved = savedPositions.get(id)
    if (saved && saved.parentId === place.parentId && saved.position === place.position) continue
    if (!saved && !findNode(store.get(), id)) continue
    changed.push({ id, ...place })
  }
  savedPositions = next
  if (changed.length === 0) return
  enqueueWrite(async (userId) => {
    const results = await Promise.all(
      changed.map(({ id, parentId, position }) =>
        db()
          .from("workspace_nodes")
          .update({ parent_id: parentId, position })
          .eq("id", id)
          .eq("user_id", userId)
          .select("id"),
      ),
    )
    for (const result of results) check(result, 1)
  })
}

function setPages(update: (pages: StudyPage[]) => StudyPage[]) {
  store.set((s) => ({ ...s, pages: update(s.pages) }))
}

function insertPage(page: StudyPage) {
  const position = positionOf(page.id)
  const records = page.studyRecords
  enqueueWrite(async (userId) => {
    check(await db().from("workspace_nodes").insert(pageInsertRow(page, userId, position)).select("id"), 1)
    if (records.length > 0) {
      const rows = records.map((r) => recordInsertRow(r, userId))
      check(await db().from("study_records").insert(rows).select("id"), rows.length)
    }
  })
}

// `starterId` picks the "+ 새 페이지" template card (lib/templates.ts pageStarters).
export function createPage(input: { title: string; starterId: string; parentId: string | null }) {
  const starter = getStarter(input.starterId)
  const page: StudyPage = {
    id: newId(),
    title: input.title.trim(),
    parentId: input.parentId,
    templateId: starter.templateId,
    createdAt: todayISO(),
    blocks: starter.createBlocks(),
    tags: [],
    studyRecords: [],
  }
  setPages((pages) => [...pages, page])
  insertPage(page)
  syncPositions()
  return page.id
}

export function updatePage(id: string, update: (page: StudyPage) => StudyPage) {
  const prev = store.get().pages.find((p) => p.id === id)
  if (!prev) return
  const next = update(prev)
  setPages((pages) => pages.map((p) => (p.id === id ? next : p)))
  savePageChanges(prev, next)
}

// A retried attachment upload finished: point the block at its Storage file. False if the page or block is gone.
export function setAttachmentPath(pageId: string, blockId: string, path: string) {
  const page = store.get().pages.find((p) => p.id === pageId)
  if (!page?.blocks.some((b) => b.id === blockId)) return false
  updatePage(pageId, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, path } : b)) }))
  return true
}

function savePageChanges(prev: StudyPage, next: StudyPage) {
  const columns = changedPageColumns(prev, next)
  const debounced = Object.fromEntries(Object.entries(columns).filter(([k]) => DEBOUNCED_PAGE_COLUMNS.includes(k as never)))
  const immediate = Object.fromEntries(Object.entries(columns).filter(([k]) => !DEBOUNCED_PAGE_COLUMNS.includes(k as never)))
  const writeColumns = async (patch: object, userId: string) => {
    check(await db().from("workspace_nodes").update(patch).eq("id", next.id).eq("user_id", userId).select("id"), 1)
  }
  if (Object.keys(debounced).length > 0) schedulePatch(`node:${next.id}`, debounced, writeColumns, DEBOUNCE_MS)
  // Sending immediately also flushes any pending debounced columns of the same page.
  if (Object.keys(immediate).length > 0) schedulePatch(`node:${next.id}`, immediate, writeColumns, 0)

  if (prev.studyRecords === next.studyRecords) return
  const before = new Map(prev.studyRecords.map((r) => [r.id, r]))
  const after = new Set(next.studyRecords.map((r) => r.id))
  const added: PageStudyRecord[] = []
  const changed: PageStudyRecord[] = []
  for (const record of next.studyRecords) {
    const old = before.get(record.id)
    if (!old) added.push(record)
    else if (old !== record) changed.push(record)
  }
  const removed = prev.studyRecords.filter((r) => !after.has(r.id)).map((r) => r.id)
  if (added.length + changed.length + removed.length === 0) return

  enqueueWrite(async (userId) => {
    const records = db().from("study_records")
    if (added.length > 0) {
      const rows = added.map((r) => recordInsertRow({ ...r, pageId: next.id }, userId))
      check(await records.insert(rows).select("id"), rows.length)
    }
    for (const record of changed) {
      check(await records.update(recordUpdateRow(record)).eq("id", record.id).eq("user_id", userId).select("id"), 1)
    }
    if (removed.length > 0) {
      check(await records.delete().in("id", removed).eq("user_id", userId).select("id"), removed.length)
    }
  })
}

export function renamePage(id: string, title: string) {
  updatePage(id, (p) => ({ ...p, title }))
}

export function setPageStudyEnabled(id: string, studyEnabled: boolean) {
  updatePage(id, (p) => ({ ...p, studyEnabled }))
}

// ---- 학습 기록 바로 남기기 (D-24)

// Adds a record to a page from outside the page (빠른 기록, 타이머). A page with study off gets it turned on,
// so the record is visible there. Like adding on the page, a new record clears manual status/understanding.
export function addPageRecord(pageId: string, record: PageStudyRecord) {
  updatePage(pageId, ({ status: _s, understanding: _u, ...p }) => ({
    ...p,
    ...(isStudyOn(p) ? {} : { studyEnabled: true }),
    studyRecords: [...p.studyRecords, { ...record, pageId }],
  }))
}

function writeRecord(run: (records: ReturnType<ReturnType<typeof db>["from"]>, userId: string) => Promise<void>) {
  enqueueWrite(async (userId) => run(db().from("study_records"), userId))
}

export function addSubjectRecord(record: SubjectStudyRecord) {
  store.set((s) => ({ ...s, subjectRecords: [...s.subjectRecords, record] }))
  writeRecord(async (records, userId) => {
    check(await records.insert(subjectRecordInsertRow(record, userId)).select("id"), 1)
  })
}

export function updateSubjectRecord(record: SubjectStudyRecord) {
  store.set((s) => ({ ...s, subjectRecords: s.subjectRecords.map((r) => (r.id === record.id ? record : r)) }))
  writeRecord(async (records, userId) => {
    const patch = { ...recordUpdateRow(record), subject_id: record.subjectId }
    check(await records.update(patch).eq("id", record.id).eq("user_id", userId).select("id"), 1)
  })
}

export function deleteSubjectRecord(id: string) {
  store.set((s) => ({ ...s, subjectRecords: s.subjectRecords.filter((r) => r.id !== id) }))
  writeRecord(async (records, userId) => {
    check(await records.delete().eq("id", id).eq("user_id", userId).select("id"), 1)
  })
}

// "페이지에 연결": a subject record moves onto a page (same row: page_id set, subject_id cleared).
// `record` carries any edits made in the same form.
export function attachRecordToPage(record: SubjectStudyRecord, pageId: string) {
  const page = store.get().pages.find((p) => p.id === pageId)
  if (!page) return
  if (!isStudyOn(page)) setPageStudyEnabled(pageId, true)
  const { subjectId: _subject, ...fields } = record
  const moved: PageStudyRecord = { ...fields, pageId }
  // Straight into the store: going through updatePage would insert the record as a new row.
  store.set((s) => ({
    ...s,
    subjectRecords: s.subjectRecords.filter((r) => r.id !== record.id),
    pages: s.pages.map((p) => (p.id === pageId ? { ...p, studyRecords: [...p.studyRecords, moved] } : p)),
  }))
  writeRecord(async (records, userId) => {
    const patch = { ...recordUpdateRow(moved), page_id: pageId, subject_id: null }
    check(await records.update(patch).eq("id", record.id).eq("user_id", userId).select("id"), 1)
  })
}

export function duplicatePage(id: string) {
  const pages = store.get().pages
  const index = pages.findIndex((p) => p.id === id)
  if (index === -1) return
  const source = pages[index]
  const copyId = newId()
  const copy: StudyPage = {
    ...source,
    id: copyId,
    title: `${source.title || "제목 없음"} (사본)`,
    // Attachment blocks are copied with the body; copies point at the same file URL.
    blocks: source.blocks.map(cloneBlock),
    note: source.note && {
      learned: source.note.learned.map(cloneBlock),
      concepts: source.note.concepts.map((c) => ({ ...c })),
      confusions: source.note.confusions.map((c) => ({ ...c })),
    },
    // Records stay with the original: copying them would count the same study time twice (R7).
    studyRecords: [],
  }
  // The copy goes right after the source in sibling order.
  store.set((s) => {
    const order = flattenTree(s).map((e) => e.node.id)
    order.splice(order.indexOf(id) + 1, 0, copyId)
    return { ...s, order, pages: [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)] }
  })
  insertPage(copy)
  syncPositions()
}

function subtreeIds(s: TreeSource, rootId: string) {
  const isUnder = (parentId: string | null) => nodePath(s, parentId).some((n) => n.id === rootId)
  return new Set([...s.pages, ...s.groups].filter((n) => n.id === rootId || isUnder(n.parentId)).map((n) => n.id))
}

// Plans whose target (a subject or a page) is the node or anything under it. Deleting the node deletes these too;
// the delete confirmation says how many (R7).
export function plansInSubtree(tree: TreeSource, rootId: string) {
  const ids = subtreeIds(tree, rootId)
  return getPlans().filter((p) => {
    const target = p.target.scope === "subject" ? p.target.subjectId : p.target.scope === "page" ? p.target.pageId : null
    return target !== null && ids.has(target)
  })
}

// Removes a node and everything under it, and the plans that target any of it. In the DB the plans go first
// (learning_plans.target_node_id is ON DELETE RESTRICT), then only the root row: workspace_nodes.parent_id and
// study_records.page_id cascade. Writes run in call order, so the plan deletes land before the node delete.
// Deleting is undoable for a few seconds: the node leaves the screen at once, but the DB delete waits in the
// scheduled-write queue. [되돌리기] cancels it and puts everything back; closing or hiding the tab, or signing
// out, sends it right away (the queue flushes then), so a delete is never silently lost.
export const UNDO_DELETE_MS = 8000

function removeSubtree(rootId: string) {
  const s = store.get()
  const removed = subtreeIds(s, rootId)
  if (removed.size === 0) return false

  // Save pending edits (a just-typed title, body) first, so an undo brings back what was on screen.
  for (const nodeId of removed) flushScheduledKey(`node:${nodeId}`)

  // Whole lists, not just the removed nodes: when `order` doesn't rank a node, list position decides its place.
  const snapshot = {
    pages: s.pages,
    groups: s.groups,
    subjectRecords: s.subjectRecords,
    order: s.order,
    removed,
    plans: detachPlans(plansInSubtree(s, rootId).map((p) => p.id)),
  }
  const name = findNode(s, rootId)?.node.name || "제목 없음"

  // Subject records go with their subject (study_records.subject_id cascades in the DB).
  store.set((state) => ({
    pages: state.pages.filter((p) => !removed.has(p.id)),
    groups: state.groups.filter((g) => !removed.has(g.id)),
    subjectRecords: state.subjectRecords.filter((r) => !removed.has(r.subjectId)),
    order: state.order.filter((nodeId) => !removed.has(nodeId)),
  }))
  for (const nodeId of removed) savedPositions.delete(nodeId)
  syncPositions()

  const key = `delete:${rootId}`
  const planIds = snapshot.plans.map((p) => p.id)
  schedulePatch(
    key,
    {},
    async (_patch, userId) => {
      // Plans first: learning_plans.target_node_id is ON DELETE RESTRICT (R7).
      await deletePlanRows(planIds, userId)
      check(await db().from("workspace_nodes").delete().eq("id", rootId).eq("user_id", userId).select("id"), 1)
    },
    UNDO_DELETE_MS,
  )

  toast(`“${name}” 삭제했어요`, {
    duration: UNDO_DELETE_MS,
    action: { label: "되돌리기", onClick: () => undoDelete(key, snapshot) },
  })
  return true
}

function undoDelete(
  key: string,
  snapshot: {
    pages: StudyPage[]
    groups: WorkspaceGroup[]
    subjectRecords: SubjectStudyRecord[]
    order: string[]
    removed: Set<string>
    plans: LearningPlan[]
  },
) {
  if (!cancelScheduled(key)) {
    toast.error("이미 삭제가 저장돼서 되돌릴 수 없어요")
    return
  }
  store.set((state) => {
    // Old lists in their old order (current versions of nodes that stayed), then anything created since.
    const merge = <T extends { id: string }>(before: T[], now: T[]) => {
      const nowById = new Map(now.map((x) => [x.id, x]))
      // Only this delete's nodes come back; something deleted separately since then stays deleted.
      const restored = before.filter((x) => nowById.has(x.id) || snapshot.removed.has(x.id)).map((x) => nowById.get(x.id) ?? x)
      return [...restored, ...now.filter((x) => !before.some((b) => b.id === x.id))]
    }
    const pages = merge(snapshot.pages, state.pages)
    const groups = merge(snapshot.groups, state.groups)
    const present = new Set([...pages.map((p) => p.id), ...groups.map((g) => g.id)])
    const order = [...snapshot.order.filter((id) => present.has(id)), ...state.order.filter((id) => !snapshot.order.includes(id))]
    const restoredRecords = snapshot.subjectRecords.filter(
      (r) => snapshot.removed.has(r.subjectId) && !state.subjectRecords.some((x) => x.id === r.id),
    )
    return { pages, groups, order, subjectRecords: [...state.subjectRecords, ...restoredRecords] }
  })
  reattachPlans(snapshot.plans)
  syncPositions()
  toast.success("되돌렸어요")
}

// Removes the page and everything nested under it, including groups and the plans that target them.
export function deletePage(id: string) {
  return removeSubtree(id)
}

export type DropPosition = "before" | "after" | "inside"

// A node can't move into itself or its own subtree.
export function canMoveNode(tree: TreeSource, dragId: string, targetId: string | null, position: DropPosition) {
  if (dragId === targetId) return false
  const newParentId = position === "inside" || !targetId ? targetId : (findNode(tree, targetId)?.parentId ?? null)
  return !nodePath(tree, newParentId).some((n) => n.id === dragId)
}

// targetId null drops the node at the end of the top level.
export function moveNode(dragId: string, targetId: string | null, position: DropPosition) {
  const s = store.get()
  if (!findNode(s, dragId) || (targetId && !findNode(s, targetId))) return
  if (!canMoveNode(s, dragId, targetId, position)) return

  const newParentId = position === "inside" || !targetId ? targetId : (findNode(s, targetId)?.parentId ?? null)
  const order = flattenTree(s).map((e) => e.node.id).filter((id) => id !== dragId)
  const targetIndex = targetId ? order.indexOf(targetId) : -1
  const insertAt =
    !targetId || position === "inside" ? order.length : position === "before" ? targetIndex : targetIndex + 1
  order.splice(insertAt, 0, dragId)

  store.set(() => ({
    ...s,
    order,
    groups: s.groups.map((g) => (g.id === dragId ? { ...g, parentId: newParentId } : g)),
    pages: s.pages.map((p) => (p.id === dragId ? { ...p, parentId: newParentId } : p)),
  }))
  syncPositions()
}

export function addGroup(name: string, parentId: string | null = null, kind: GroupKind = "folder") {
  const group: WorkspaceGroup = { id: newId(), name: name.trim(), parentId, kind }
  store.set((s) => ({ ...s, groups: [...s.groups, group] }))
  const position = positionOf(group.id)
  enqueueWrite(async (userId) => {
    check(await db().from("workspace_nodes").insert(groupInsertRow(group, userId, position)).select("id"), 1)
  })
  syncPositions()
  return group.id
}

function updateGroupRow(id: string, patch: { title?: string; kind?: GroupKind }) {
  enqueueWrite(async (userId) => {
    check(await db().from("workspace_nodes").update(patch).eq("id", id).eq("user_id", userId).select("id"), 1)
  })
}

export function renameGroup(id: string, name: string) {
  const next = name.trim()
  if (!next) return
  const current = store.get().groups.find((g) => g.id === id)
  if (!current || current.name === next) return
  store.set((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, name: next } : g)) }))
  updateGroupRow(id, { title: next })
}

// Removes the group and everything nested under it, including the plans that target any of it (R7).
export function deleteGroup(id: string) {
  return removeSubtree(id)
}

// A subject that plans point at can't become a folder (R7). Returns false when the change is refused.
export function setGroupKind(id: string, kind: GroupKind) {
  if (kind === "folder" && plansTargetingSubject(getPlans(), id).length > 0) return false
  // Subject records point at the subject; a folder can't hold them.
  if (kind === "folder" && store.get().subjectRecords.some((r) => r.subjectId === id)) return false
  const current = store.get().groups.find((g) => g.id === id)
  if (!current) return false
  if (current.kind === kind) return true
  store.set((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, kind } : g)) }))
  updateGroupRow(id, { kind })
  return true
}

// ---- 예시 데이터 가져오기
// Copies the seed workspace (lib/study-tree.ts, lib/study-pages.ts) and examplePlans into the signed-in user's DB
// with new uuids. Only for an empty workspace: it never touches existing rows, and it re-checks the DB before writing
// so a second tab or a double click can't import twice. Seed dates are shifted so the newest record is yesterday; each
// record's createdAt is noon of its study date, so it never counts as part of a running timer session (R5).
let importing = false

export type ImportResult = "imported" | "not-empty" | "busy" | "failed"

export async function importExampleData(): Promise<ImportResult> {
  const current = store.get()
  if (importing) return "busy"
  if (current.groups.length > 0 || current.pages.length > 0) return "not-empty"
  importing = true
  try {
    const userId = currentUserId()
    if (!userId) return "failed"
    const { data, error } = await db().from("workspace_nodes").select("id").eq("user_id", userId).limit(1)
    if (error) throw error
    const latest = store.get()
    if ((data?.length ?? 0) > 0 || latest.groups.length > 0 || latest.pages.length > 0) return "not-empty"

    // Shift every seed date by the same number of days so the newest record lands on yesterday. Review dates,
    // "N일 전" and weekly stats then look like recent study instead of weeks-old data.
    const seedDates = studyPages.flatMap((p) => p.studyRecords.map((r) => r.date))
    const latestSeed = seedDates.reduce((a, b) => (b > a ? b : a), seedDates[0] ?? todayISO())
    const shiftDays = daysBetween(latestSeed, addDays(todayISO(), -1))
    const shift = (iso: string) => addDays(iso, shiftDays)

    const ids = new Map<string, string>()
    const idFor = (seedId: string) => {
      if (!ids.has(seedId)) ids.set(seedId, newId())
      return ids.get(seedId)!
    }
    const seedGroups: WorkspaceGroup[] = studyTree.flatMap((group) => [
      { id: group.id, name: group.name, parentId: null, kind: "folder" as const },
      ...group.subjects.map((s) => ({ id: s.id, name: s.name, parentId: group.id, kind: "subject" as const })),
    ])
    const seedOrder = flattenTree({ groups: seedGroups, pages: studyPages }).map((e) => e.node.id)
    const groups = seedGroups.map((g) => ({ ...g, id: idFor(g.id), parentId: g.parentId && idFor(g.parentId) }))
    const pages: StudyPage[] = studyPages.map((p) => {
      const pageId = idFor(p.id)
      return {
        ...p,
        id: pageId,
        parentId: p.parentId && idFor(p.parentId),
        createdAt: shift(p.createdAt),
        blocks: p.blocks.map(cloneBlock),
        note: p.note && {
          learned: p.note.learned.map(cloneBlock),
          concepts: p.note.concepts.map((c) => ({ ...c })),
          confusions: p.note.confusions.map((c) => ({ ...c })),
        },
        tags: [...p.tags],
        studyRecords: p.studyRecords.map((r) => ({
          ...r,
          id: newId(),
          pageId,
          date: shift(r.date),
          createdAt: new Date(`${shift(r.date)}T12:00:00`).getTime(),
          tags: [...r.tags],
        })),
      }
    })
    const plans: LearningPlan[] = examplePlans.map((plan) => ({
      ...plan,
      id: newId(),
      startDate: shift(plan.startDate),
      endDate: shift(plan.endDate),
      target:
        plan.target.scope === "subject"
          ? { scope: "subject", subjectId: idFor(plan.target.subjectId) }
          : plan.target.scope === "page"
            ? { scope: "page", pageId: idFor(plan.target.pageId) }
            : { scope: "all" },
    }))

    store.set(() => ({ groups, pages, subjectRecords: [], order: seedOrder.map(idFor) }))
    const positions = siblingPositions(store.get())
    savedPositions = new Map(positions)
    const byId = new Map<string, WorkspaceGroup | StudyPage>([...groups, ...pages].map((n) => [n.id, n]))
    // One insert per tree depth, shallowest first, so every parent row exists before its children are inserted.
    const levels: ReturnType<typeof groupInsertRow | typeof pageInsertRow>[][] = []
    for (const { node, depth } of flattenTree(store.get())) {
      const n = byId.get(node.id)!
      const position = positions.get(node.id)?.position ?? 0
      ;(levels[depth] ??= []).push("templateId" in n ? pageInsertRow(n, userId, position) : groupInsertRow(n, userId, position))
    }
    const recordRows = pages.flatMap((p) => p.studyRecords.map((r) => recordInsertRow(r, userId)))
    enqueueWrite(async (uid) => {
      if (uid !== userId) throw new Error("로그인한 계정이 바뀌었어요. 다시 시도해 주세요.")
      for (const rows of levels) check(await db().from("workspace_nodes").insert(rows).select("id"), rows.length)
      check(await db().from("study_records").insert(recordRows).select("id"), recordRows.length)
    })
    insertPlans(plans)
    return "imported"
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error)
    toast.error(`예시 데이터를 가져오지 못했어요. (${message})`)
    return "failed"
  } finally {
    importing = false
  }
}

// The tree has no fixed depth: a group holds groups or pages, and a page can hold child pages.
// Study records are page data (StudyPage.studyRecords), never tree nodes.
export type NodeKind = GroupKind | "page"

export interface TreeNode {
  id: string
  name: string
  kind: NodeKind
}

type TreeSource = Pick<WorkspaceState, "groups" | "pages"> & { order?: string[] }

export type ChildNode = { type: "group"; group: WorkspaceGroup } | { type: "page"; page: StudyPage }

// Direct children of a node (groups and pages mixed), in the user's order.
export function childNodes(tree: TreeSource, parentId: string | null): ChildNode[] {
  const rank = new Map((tree.order ?? []).map((id, i) => [id, i]))
  const children: ChildNode[] = [
    ...tree.groups.filter((g) => g.parentId === parentId).map((group) => ({ type: "group" as const, group })),
    ...tree.pages.filter((p) => p.parentId === parentId).map((page) => ({ type: "page" as const, page })),
  ]
  const idOf = (c: ChildNode) => (c.type === "group" ? c.group.id : c.page.id)
  return children
    .map((child, i) => ({ child, key: rank.get(idOf(child)) ?? rank.size + i }))
    .sort((a, b) => a.key - b.key)
    .map((e) => e.child)
}

function findNode({ groups, pages }: TreeSource, id: string | null) {
  if (!id) return null
  const group = groups.find((g) => g.id === id)
  if (group) return { node: { id: group.id, name: group.name, kind: group.kind } as TreeNode, parentId: group.parentId }
  const page = pages.find((p) => p.id === id)
  if (page) return { node: { id: page.id, name: page.title || "제목 없음", kind: "page" } as TreeNode, parentId: page.parentId }
  return null
}

export function nodeExists(tree: TreeSource, id: string | null | undefined) {
  return Boolean(id && findNode(tree, id))
}

// Root-to-node path, inclusive of the node itself.
export function nodePath(tree: TreeSource, id: string | null) {
  const path: TreeNode[] = []
  const seen = new Set<string>()
  let current = findNode(tree, id)
  while (current && !seen.has(current.node.id)) {
    seen.add(current.node.id)
    path.unshift(current.node)
    current = findNode(tree, current.parentId)
  }
  return path
}

// Subjects are optional markers anywhere in the tree; plans and analytics target the closest one.
export function nearestSubject(tree: TreeSource, id: string | null) {
  return nodePath(tree, id).findLast((n) => n.kind === "subject") ?? null
}

// Label for pages with no subject above them (page properties, review list, analytics).
export const NO_SUBJECT = "과목 없음"

// Every page somewhere under the given node, at any depth.
export function descendantPages(tree: TreeSource, ancestorId: string) {
  return tree.pages.filter((p) => nodePath(tree, p.parentId).some((n) => n.id === ancestorId))
}

// Every group somewhere under the given node, at any depth.
export function descendantGroups(tree: TreeSource, ancestorId: string) {
  return tree.groups.filter((g) => nodePath(tree, g.parentId).some((n) => n.id === ancestorId))
}

// Depth-first list of every possible parent (groups and pages) for location pickers.
export function flattenTree(tree: TreeSource, parentId: string | null = null, depth = 0) {
  const result: { node: TreeNode; depth: number }[] = []
  for (const child of childNodes(tree, parentId)) {
    const node: TreeNode =
      child.type === "group"
        ? { id: child.group.id, name: child.group.name, kind: child.group.kind }
        : { id: child.page.id, name: child.page.title || "제목 없음", kind: "page" }
    result.push({ node, depth }, ...flattenTree(tree, node.id, depth + 1))
  }
  return result
}
