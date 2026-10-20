import { toast } from "sonner"
import { createStore } from "@/lib/create-store"
import { cloneBlock, studyPages, todayISO, type PageStudyRecord, type StudyPage } from "@/lib/study-pages"
import { studyTree } from "@/lib/study-tree"
import { getTemplate, type TemplateId } from "@/lib/templates"
import { examplePlans, getPlans, insertPlans, plansTargetingSubject, type LearningPlan } from "@/lib/plans"
import { check, currentUserId, db, dropScheduled, enqueueWrite, schedulePatch } from "@/lib/db/queue"
import {
  changedPageColumns,
  DEBOUNCED_PAGE_COLUMNS,
  groupInsertRow,
  newId,
  pageInsertRow,
  recordInsertRow,
  recordUpdateRow,
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
  // Sibling order for groups and pages alike; ids missing here sort after listed ones.
  order: string[]
}

// The signed-in user's workspace lives in Supabase (workspace_nodes + study_records). This store is the screen cache:
// it starts empty (server snapshot too, so hydration matches), lib/db/sync.ts fills it after sign-in, and every
// function below updates it first and then queues the matching DB write. A failed write reloads from the DB.
// The seed pages in lib/study-tree.ts and lib/study-pages.ts are no longer loaded here.
const emptyWorkspace: WorkspaceState = { groups: [], pages: [], order: [] }
const store = createStore<WorkspaceState>(emptyWorkspace)

export const useWorkspace = store.useStore

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

export function createPage(input: { title: string; templateId: TemplateId; parentId: string | null }) {
  const page: StudyPage = {
    id: newId(),
    title: input.title.trim(),
    parentId: input.parentId,
    templateId: input.templateId,
    createdAt: todayISO(),
    ...getTemplate(input.templateId).createContent(),
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
    // Records keep their original createdAt (R7).
    studyRecords: source.studyRecords.map((r) => ({ ...r, id: newId(), pageId: copyId })),
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

// Removes a node and everything under it. In the DB only the root row is deleted: workspace_nodes.parent_id and
// study_records.page_id cascade. learning_plans.target_node_id is ON DELETE RESTRICT, so a subtree that any plan
// points at is refused up front instead of failing in the DB. Returns false when refused.
function removeSubtree(rootId: string) {
  const s = store.get()
  const isUnder = (parentId: string | null) => nodePath(s, parentId).some((n) => n.id === rootId)
  const removed = new Set(
    [...s.pages, ...s.groups].filter((n) => n.id === rootId || isUnder(n.parentId)).map((n) => n.id),
  )
  if (removed.size === 0) return false

  const blocking = getPlans().filter((p) => {
    const target = p.target.scope === "subject" ? p.target.subjectId : p.target.scope === "page" ? p.target.pageId : null
    return target !== null && removed.has(target)
  })
  if (blocking.length > 0) {
    toast.error(`이 항목이나 하위 항목을 대상으로 한 학습 계획이 ${blocking.length}개 있어서 삭제할 수 없어요. 계획을 먼저 삭제해 주세요.`)
    return false
  }

  store.set((state) => ({
    pages: state.pages.filter((p) => !removed.has(p.id)),
    groups: state.groups.filter((g) => !removed.has(g.id)),
    order: state.order.filter((nodeId) => !removed.has(nodeId)),
  }))
  for (const nodeId of removed) {
    dropScheduled(`node:${nodeId}`)
    savedPositions.delete(nodeId)
  }

  enqueueWrite(async (userId) => {
    check(await db().from("workspace_nodes").delete().eq("id", rootId).eq("user_id", userId).select("id"), 1)
  })
  syncPositions()
  return true
}

// Removes the page and everything nested under it, including groups. Returns false when refused (see removeSubtree).
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

// Removes the group and everything nested under it. A subject that plans point at can't be deleted (R7),
// same as turning it into a folder. Returns false when the delete is refused.
export function deleteGroup(id: string) {
  if (plansTargetingSubject(getPlans(), id).length > 0) return false
  return removeSubtree(id)
}

// A subject that plans point at can't become a folder (R7). Returns false when the change is refused.
export function setGroupKind(id: string, kind: GroupKind) {
  if (kind === "folder" && plansTargetingSubject(getPlans(), id).length > 0) return false
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
// so a second tab or a double click can't import twice. Record dates stay as seeded; each record's createdAt is noon
// of its study date (the seed has none), so it never counts as part of a running timer session (R5).
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
          createdAt: r.createdAt ?? new Date(`${r.date}T12:00:00`).getTime(),
          tags: [...r.tags],
        })),
      }
    })
    const plans: LearningPlan[] = examplePlans.map((plan) => ({
      ...plan,
      id: newId(),
      target:
        plan.target.scope === "subject"
          ? { scope: "subject", subjectId: idFor(plan.target.subjectId) }
          : plan.target.scope === "page"
            ? { scope: "page", pageId: idFor(plan.target.pageId) }
            : { scope: "all" },
    }))

    store.set(() => ({ groups, pages, order: seedOrder.map(idFor) }))
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

// Every page somewhere under the given node, at any depth.
export function descendantPages(tree: TreeSource, ancestorId: string) {
  return tree.pages.filter((p) => nodePath(tree, p.parentId).some((n) => n.id === ancestorId))
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
