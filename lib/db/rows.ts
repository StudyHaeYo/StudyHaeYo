import type { LearningPlan, PlanTarget } from "@/lib/plans"
import {
  pageStatuses,
  withNoteBlocks,
  toISODate,
  type Block,
  type PageStudyRecord,
  type StudyNoteContent,
  type StudyRecordFields,
  type SubjectStudyRecord,
  type StudyPage,
  type PageProps,
} from "@/lib/study-pages"
import { templateRegistry, type TemplateId } from "@/lib/templates"
import type { StudyType } from "@/lib/types"
import type { GroupKind, WorkspaceGroup, WorkspaceState } from "@/lib/workspace"
import type { Todo } from "@/lib/todos"

// Row shapes of the Supabase tables, column for column. The app types stay as they are;
// these mappers are the only place that knows both sides.

export interface NodeRow {
  id: string
  user_id: string
  parent_id: string | null
  kind: string
  title: string
  position: number
  template_id: string | null
  created_on: string | null
  study_type: string | null
  blocks: unknown
  note: unknown
  tags: string[] | null
  status: string | null
  understanding: number | null
  study_enabled: boolean | null
  // Added by supabase/migrations/20261031_page_props.sql; missing before it runs.
  props?: unknown
  created_at: string
}

export interface RecordRow {
  id: string
  user_id: string
  // One of the two is set (check constraint): a page record, or a subject record without a page (D-24).
  page_id: string | null
  subject_id?: string | null
  study_date: string
  created_at: string | null
  duration_minutes: number
  understanding: number | null
  study_content: string | null
  difficulties: string | null
  next_steps: string | null
  tags: string[] | null
}

export interface PlanRow {
  id: string
  user_id: string
  title: string
  start_date: string
  end_date: string
  goal: string | null
  // Added by supabase/migrations/20261025_plan_goal_minutes.sql; missing before it runs.
  goal_minutes?: number | null
  target_scope: string
  target_node_id: string | null
  created_at: string
}

export const LEGACY_NODE_COLUMNS =
  "id, user_id, parent_id, kind, title, position, template_id, created_on, study_type, blocks, note, tags, status, understanding, study_enabled, created_at"
export const NODE_COLUMNS = `${LEGACY_NODE_COLUMNS}, props`
const RECORD_BASE_COLUMNS =
  "id, user_id, page_id, study_date, created_at, duration_minutes, understanding, study_content, difficulties, next_steps, tags"
export const RECORD_COLUMNS = `${RECORD_BASE_COLUMNS}, subject_id`
// Before supabase/migrations/20261024_subject_records.sql is applied the table has no subject_id column.
export const LEGACY_RECORD_COLUMNS = RECORD_BASE_COLUMNS
export const LEGACY_PLAN_COLUMNS = "id, user_id, title, start_date, end_date, goal, target_scope, target_node_id, created_at"
export const PLAN_COLUMNS = `${LEGACY_PLAN_COLUMNS}, goal_minutes`

export const PAGE_KIND = "page"
const groupKinds: GroupKind[] = ["folder", "subject"]
const studyTypes: StudyType[] = ["강의", "문제풀이", "복습", "정리"]
const templateIds = templateRegistry.map((t) => t.id) as TemplateId[]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const newId = () => crypto.randomUUID()

function oneOf<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined
}

function understandingOf(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function noteOrUndefined(value: unknown): StudyNoteContent | undefined {
  if (!value || typeof value !== "object") return undefined
  const note = value as Partial<StudyNoteContent>
  if (!Array.isArray(note.learned) || !Array.isArray(note.concepts) || !Array.isArray(note.confusions)) return undefined
  return note as StudyNoteContent
}

// ---- DB → app

function recordFields(row: RecordRow): StudyRecordFields {
  return {
    id: row.id,
    date: row.study_date,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    durationMinutes: Math.max(0, row.duration_minutes ?? 0),
    // The column is nullable but the app always writes 1–5; a missing value reads as the middle score.
    understanding: understandingOf(row.understanding) ?? 3,
    studyContent: row.study_content ?? "",
    difficulties: row.difficulties ?? "",
    nextSteps: row.next_steps ?? "",
    tags: stringList(row.tags),
  }
}

function toPage(row: NodeRow, records: PageStudyRecord[]): StudyPage {
  return withNoteBlocks({
    id: row.id,
    title: row.title,
    parentId: row.parent_id,
    templateId: oneOf(templateIds, row.template_id) ?? "blank",
    createdAt: row.created_on ?? toISODate(new Date(row.created_at)),
    studyType: oneOf(studyTypes, row.study_type),
    blocks: Array.isArray(row.blocks) ? (row.blocks as Block[]) : [],
    note: noteOrUndefined(row.note),
    tags: stringList(row.tags),
    studyRecords: records,
    status: oneOf(pageStatuses, row.status),
    understanding: understandingOf(row.understanding),
    studyEnabled: row.study_enabled ?? undefined,
    ...(isPlainObject(row.props) && Object.keys(row.props).length > 0 ? { props: row.props as PageProps } : {}),
  })
}

// Rows arrive sorted by (position, created_at); position only orders siblings, so one global list works as `order`.
export function toWorkspaceState(nodes: NodeRow[], records: RecordRow[]): WorkspaceState {
  const byPage = new Map<string, PageStudyRecord[]>()
  const subjectRecords: SubjectStudyRecord[] = []
  for (const row of records) {
    if (row.page_id) {
      const list = byPage.get(row.page_id) ?? []
      list.push({ ...recordFields(row), pageId: row.page_id })
      byPage.set(row.page_id, list)
    } else {
      // No note: on a subject, or on nothing at all (외부 학습, D-24).
      subjectRecords.push({ ...recordFields(row), subjectId: row.subject_id ?? null })
    }
  }
  const groups: WorkspaceGroup[] = []
  const pages: StudyPage[] = []
  for (const row of nodes) {
    const kind = oneOf(groupKinds, row.kind)
    if (kind) groups.push({ id: row.id, name: row.title, parentId: row.parent_id, kind })
    else if (row.kind === PAGE_KIND) pages.push(toPage(row, byPage.get(row.id) ?? []))
  }
  return { groups, pages, subjectRecords, order: nodes.map((n) => n.id) }
}

export function toPlan(row: PlanRow): LearningPlan {
  let target: PlanTarget = { scope: "all" }
  if (row.target_scope === "subject" && row.target_node_id) target = { scope: "subject", subjectId: row.target_node_id }
  if (row.target_scope === "page" && row.target_node_id) target = { scope: "page", pageId: row.target_node_id }
  return {
    id: row.id,
    title: row.title,
    target,
    startDate: row.start_date,
    endDate: row.end_date,
    goal: row.goal ?? "",
    ...(row.goal_minutes && row.goal_minutes > 0 ? { goalMinutes: row.goal_minutes } : {}),
  }
}

// ---- app → DB

type PageColumns = Pick<
  NodeRow,
  "title" | "template_id" | "study_type" | "blocks" | "note" | "tags" | "status" | "understanding" | "study_enabled" | "props"
>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function pageColumns(page: StudyPage): PageColumns {
  return {
    template_id: page.templateId,
    // Only sent once the page has props, so pages still save before the props column exists (D-27).
    ...(page.props ? { props: page.props } : {}),
    title: page.title,
    study_type: page.studyType ?? null,
    blocks: page.blocks,
    note: page.note ?? null,
    tags: page.tags,
    status: page.status ?? null,
    understanding: page.understanding ?? null,
    study_enabled: page.studyEnabled ?? null,
  }
}

export function pageInsertRow(page: StudyPage, userId: string, position: number) {
  return {
    id: page.id,
    user_id: userId,
    parent_id: page.parentId,
    kind: PAGE_KIND,
    position,
    created_on: ISO_DATE.test(page.createdAt) ? page.createdAt : toISODate(new Date()),
    ...pageColumns(page),
  }
}

export function groupInsertRow(group: WorkspaceGroup, userId: string, position: number) {
  return { id: group.id, user_id: userId, parent_id: group.parentId, kind: group.kind, title: group.name, position }
}

// Columns that changed between two versions of a page. Bodies are compared by reference:
// every edit produces a new array/object, so an unchanged reference means an unchanged value.
export function changedPageColumns(prev: StudyPage, next: StudyPage): Partial<PageColumns> {
  const a = pageColumns(prev)
  const b = pageColumns(next)
  const patch: Partial<PageColumns> = {}
  for (const key of Object.keys(b) as (keyof PageColumns)[]) {
    if (a[key] !== b[key]) Object.assign(patch, { [key]: b[key] })
  }
  return patch
}

// Typing in the title and body calls updatePage on every keystroke; those columns are sent debounced.
export const DEBOUNCED_PAGE_COLUMNS: (keyof PageColumns)[] = ["title", "blocks", "note"]

function recordColumns(record: StudyRecordFields) {
  return {
    study_date: ISO_DATE.test(record.date) ? record.date : toISODate(new Date()),
    duration_minutes: Math.max(0, Math.round(Number(record.durationMinutes) || 0)),
    understanding: understandingOf(record.understanding) ?? null,
    study_content: record.studyContent,
    difficulties: record.difficulties,
    next_steps: record.nextSteps,
    tags: record.tags,
  }
}

export function recordInsertRow(record: PageStudyRecord, userId: string) {
  return {
    id: record.id,
    user_id: userId,
    page_id: record.pageId,
    created_at: new Date(record.createdAt ?? Date.now()).toISOString(),
    ...recordColumns(record),
  }
}

export function subjectRecordInsertRow(record: SubjectStudyRecord, userId: string) {
  return {
    id: record.id,
    user_id: userId,
    page_id: null,
    subject_id: record.subjectId,
    created_at: new Date(record.createdAt ?? Date.now()).toISOString(),
    ...recordColumns(record),
  }
}

export const recordUpdateRow = recordColumns

export function planInsertRow(plan: LearningPlan, userId: string) {
  const targetId =
    plan.target.scope === "subject" ? plan.target.subjectId : plan.target.scope === "page" ? plan.target.pageId : null
  return {
    id: plan.id,
    user_id: userId,
    title: plan.title,
    start_date: plan.startDate,
    end_date: plan.endDate,
    goal: plan.goal,
    // Only sent when set, so plans can still be saved before the goal_minutes column exists.
    ...(plan.goalMinutes ? { goal_minutes: Math.round(plan.goalMinutes) } : {}),
    target_scope: plan.target.scope,
    target_node_id: targetId,
  }
}

// ---- todos (오늘의 체크리스트)

export interface TodoRow {
  id: string
  user_id: string
  title: string
  due_on: string
  done_at: string | null
  position: number
  created_at: string
}

export const TODO_COLUMNS = "id, user_id, title, due_on, done_at, position, created_at"

export function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    dueOn: row.due_on,
    doneAt: row.done_at ? new Date(row.done_at).getTime() : null,
    position: row.position,
  }
}

export function todoInsertRow(todo: Todo, userId: string) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    due_on: todo.dueOn,
    done_at: todo.doneAt === null ? null : new Date(todo.doneAt).toISOString(),
    position: todo.position,
  }
}
