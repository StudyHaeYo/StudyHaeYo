import { createStore } from "@/lib/create-store"
import { studyTree } from "@/lib/study-tree"
import { studyPages, todayISO, type StudyPage } from "@/lib/study-pages"
import { templates, type TemplateId } from "@/lib/templates"

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
}

const seedGroups: WorkspaceGroup[] = studyTree.flatMap((group) => [
  { id: group.id, name: group.name, parentId: null, kind: "folder" as const },
  ...group.subjects.map((s) => ({ id: s.id, name: s.name, parentId: group.id, kind: "subject" as const })),
])

const store = createStore<WorkspaceState>({ groups: seedGroups, pages: studyPages })

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
    blocks: templates[input.templateId].createBlocks(),
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
      studyRecords: source.studyRecords.map((r) => ({ ...r, id: `${r.id}-${copyId}`, pageId: copyId })),
    }
    return [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)]
  })
}

export function deletePage(id: string) {
  store.set((s) => {
    const removed = new Set([id, ...descendantPages(s, id).map((p) => p.id)])
    return { ...s, pages: s.pages.filter((p) => !removed.has(p.id)) }
  })
}

export function addGroup(name: string, parentId: string | null = null, kind: GroupKind = "folder") {
  const group: WorkspaceGroup = { id: uid("g"), name: name.trim(), parentId, kind }
  store.set((s) => ({ ...s, groups: [...s.groups, group] }))
  return group.id
}

// The tree has no fixed depth: a group holds groups or pages, and a page can hold child pages.
// Study records are page data (StudyPage.studyRecords), never tree nodes.
export type NodeKind = GroupKind | "page"

export interface TreeNode {
  id: string
  name: string
  kind: NodeKind
}

type TreeSource = Pick<WorkspaceState, "groups" | "pages">

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
  for (const group of tree.groups.filter((g) => g.parentId === parentId)) {
    result.push({ node: { id: group.id, name: group.name, kind: group.kind }, depth }, ...flattenTree(tree, group.id, depth + 1))
  }
  for (const page of tree.pages.filter((p) => p.parentId === parentId)) {
    result.push({ node: { id: page.id, name: page.title || "제목 없음", kind: "page" }, depth }, ...flattenTree(tree, page.id, depth + 1))
  }
  return result
}
