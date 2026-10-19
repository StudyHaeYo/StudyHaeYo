import { createStore } from "@/lib/create-store"
import { studyTree } from "@/lib/study-tree"
import { cloneBlock, studyPages, todayISO, type StudyPage } from "@/lib/study-pages"
import { getTemplate, type TemplateId } from "@/lib/templates"
import { getPlans, plansTargetingSubject } from "@/lib/plans"

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

const seedGroups: WorkspaceGroup[] = studyTree.flatMap((group) => [
  { id: group.id, name: group.name, parentId: null, kind: "folder" as const },
  ...group.subjects.map((s) => ({ id: s.id, name: s.name, parentId: group.id, kind: "subject" as const })),
])

const store = createStore<WorkspaceState>({
  groups: seedGroups,
  pages: studyPages,
  order: flattenTree({ groups: seedGroups, pages: studyPages }).map((e) => e.node.id),
})

export const useWorkspace = store.useStore

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function setPages(update: (pages: StudyPage[]) => StudyPage[]) {
  store.set((s) => ({ ...s, pages: update(s.pages) }))
}

export function createPage(input: { title: string; templateId: TemplateId; parentId: string | null }) {
  const page: StudyPage = {
    id: uid("p"),
    title: input.title.trim(),
    parentId: input.parentId,
    templateId: input.templateId,
    createdAt: todayISO(),
    ...getTemplate(input.templateId).createContent(),
    tags: [],
    studyRecords: [],
  }
  setPages((pages) => [...pages, page])
  return page.id
}

export function updatePage(id: string, update: (page: StudyPage) => StudyPage) {
  setPages((pages) => pages.map((p) => (p.id === id ? update(p) : p)))
}

export function renamePage(id: string, title: string) {
  updatePage(id, (p) => ({ ...p, title }))
}

export function setPageStudyEnabled(id: string, studyEnabled: boolean) {
  updatePage(id, (p) => ({ ...p, studyEnabled }))
}

export function duplicatePage(id: string) {
  setPages((pages) => {
    const index = pages.findIndex((p) => p.id === id)
    if (index === -1) return pages
    const source = pages[index]
    const copyId = uid("p")
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
      studyRecords: source.studyRecords.map((r) => ({ ...r, id: `${r.id}-${copyId}`, pageId: copyId })),
    }
    return [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)]
  })
}

// Removes the page and everything nested under it, including groups.
export function deletePage(id: string) {
  store.set((s) => {
    const isUnder = (parentId: string | null) => nodePath(s, parentId).some((n) => n.id === id)
    return {
      ...s,
      pages: s.pages.filter((p) => p.id !== id && !isUnder(p.parentId)),
      groups: s.groups.filter((g) => !isUnder(g.parentId)),
    }
  })
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
  store.set((s) => {
    if (!findNode(s, dragId) || (targetId && !findNode(s, targetId))) return s
    if (!canMoveNode(s, dragId, targetId, position)) return s

    const newParentId = position === "inside" || !targetId ? targetId : (findNode(s, targetId)?.parentId ?? null)
    const order = flattenTree(s).map((e) => e.node.id).filter((id) => id !== dragId)
    const targetIndex = targetId ? order.indexOf(targetId) : -1
    const insertAt =
      !targetId || position === "inside" ? order.length : position === "before" ? targetIndex : targetIndex + 1
    order.splice(insertAt, 0, dragId)

    return {
      order,
      groups: s.groups.map((g) => (g.id === dragId ? { ...g, parentId: newParentId } : g)),
      pages: s.pages.map((p) => (p.id === dragId ? { ...p, parentId: newParentId } : p)),
    }
  })
}

export function addGroup(name: string, parentId: string | null = null, kind: GroupKind = "folder") {
  const group: WorkspaceGroup = { id: uid("g"), name: name.trim(), parentId, kind }
  store.set((s) => ({ ...s, groups: [...s.groups, group] }))
  return group.id
}

// A subject that plans point at can't become a folder (R7). Returns false when the change is refused.
export function setGroupKind(id: string, kind: GroupKind) {
  if (kind === "folder" && plansTargetingSubject(getPlans(), id).length > 0) return false
  store.set((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, kind } : g)) }))
  return true
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
