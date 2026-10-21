import {
  addDays,
  computePageStats,
  daysBetween,
  dueLabel,
  formatDate,
  unresolvedConfusionCount,
  type DueTone,
  type PageStats,
  type PageStudyRecord,
  type StudyPage,
} from "@/lib/study-pages"
import { recordCreatedAt } from "@/lib/study-session"
import { isReviewCandidate } from "@/lib/templates"
import { descendantPages, nearestSubject, type WorkspaceState } from "@/lib/workspace"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"
import type { LearningPlan } from "@/lib/plans"

const NO_SUBJECT = "내 페이지"

export function subjectOf(workspace: WorkspaceState, page: StudyPage) {
  return nearestSubject(workspace, page.parentId)?.name ?? NO_SUBJECT
}

export interface RecordEntry {
  record: PageStudyRecord
  pageId: string
  pageTitle: string
  subject: string
}

function allRecordEntries(workspace: WorkspaceState): RecordEntry[] {
  return workspace.pages.flatMap((page) => {
    const subject = subjectOf(workspace, page)
    const pageTitle = page.title || "제목 없음"
    return page.studyRecords.map((record) => ({ record, pageId: page.id, pageTitle, subject }))
  })
}

// Newest first by creation time; records without one (seeds) fall back to the start of their `date`.
function recordTime(record: PageStudyRecord) {
  const created = recordCreatedAt(record)
  if (created !== null) return created
  const [y, m, d] = record.date.split("-").map(Number)
  return new Date(y, m - 1, d).getTime()
}

function newestFirst(a: RecordEntry, b: RecordEntry) {
  return recordTime(b.record) - recordTime(a.record) || b.record.id.localeCompare(a.record.id)
}

export interface SubjectMasteryItem {
  subject: string
  progress: number
  recordCount: number
}

// Average understanding per subject as a percentage. Subjects with no records are left out.
export function subjectMastery(workspace: WorkspaceState): SubjectMasteryItem[] {
  const bySubject = new Map<string, { sum: number; count: number }>()
  for (const { record, subject } of allRecordEntries(workspace)) {
    const entry = bySubject.get(subject) ?? { sum: 0, count: 0 }
    entry.sum += record.understanding
    entry.count += 1
    bySubject.set(subject, entry)
  }
  return [...bySubject.entries()].map(([subject, { sum, count }]) => ({
    subject,
    progress: Math.round((sum / count / 5) * 100),
    recordCount: count,
  }))
}

export function todayRecords(workspace: WorkspaceState, today: string): RecordEntry[] {
  return allRecordEntries(workspace)
    .filter((e) => e.record.date === today)
    .sort(newestFirst)
}

export function recentActivity(workspace: WorkspaceState, limit = 5): RecordEntry[] {
  return allRecordEntries(workspace).sort(newestFirst).slice(0, limit)
}

export function weekStart(today: string) {
  const [y, m, d] = today.split("-").map(Number)
  const mondayOffset = (new Date(y, m - 1, d).getDay() + 6) % 7
  return addDays(today, -mondayOffset)
}

export interface WeeklyStats {
  subjects: { subject: string; minutes: number }[]
  totalMinutes: number
  goalMinutes: number
}

// Monday through today, by record `date`.
export function weeklyStats(workspace: WorkspaceState, today: string): WeeklyStats {
  const from = weekStart(today)
  const bySubject = new Map<string, number>()
  for (const { record, subject } of allRecordEntries(workspace)) {
    if (record.date < from || record.date > today) continue
    bySubject.set(subject, (bySubject.get(subject) ?? 0) + record.durationMinutes)
  }
  const subjects = [...bySubject.entries()]
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
  return {
    subjects,
    totalMinutes: subjects.reduce((sum, s) => sum + s.minutes, 0),
    goalMinutes: WEEKLY_GOAL_MINUTES,
  }
}

export interface WeakArea {
  pageId: string
  pageTitle: string
  subject: string
  understanding: number | null
  unresolved: number
}

// Any page with understanding ≤ 2 or at least one open 헷갈린 점.
// Order: more unresolved first → lower understanding (unknown last).
export function weakAreas(workspace: WorkspaceState, limit = 5): WeakArea[] {
  return workspace.pages
    .map((page) => ({
      pageId: page.id,
      pageTitle: page.title || "제목 없음",
      subject: subjectOf(workspace, page),
      understanding: computePageStats(page, null).understanding,
      unresolved: unresolvedConfusionCount(page),
    }))
    .filter((a) => (a.understanding !== null && a.understanding <= 2) || a.unresolved > 0)
    .sort((a, b) => b.unresolved - a.unresolved || (a.understanding ?? 6) - (b.understanding ?? 6))
    .slice(0, limit)
}

export interface UpcomingReview {
  pageId: string
  pageTitle: string
  subject: string
  date: string
  dateLabel: string
  due: { label: string; tone: DueTone }
}

// Same page pool as R2 (locked-on templates only), not yet 완료, with a review date.
export function upcomingReviews(workspace: WorkspaceState, today: string, limit = 5): UpcomingReview[] {
  return workspace.pages
    .filter(isReviewCandidate)
    .map((page) => ({ page, stats: computePageStats(page, today) }))
    .filter(({ stats }) => stats.status !== "완료" && stats.nextReviewAt !== null)
    .sort((a, b) => a.stats.nextReviewAt!.localeCompare(b.stats.nextReviewAt!))
    .slice(0, limit)
    .map(({ page, stats }) => {
      const date = stats.nextReviewAt!
      return {
        pageId: page.id,
        pageTitle: page.title || "제목 없음",
        subject: subjectOf(workspace, page),
        date,
        dateLabel: formatDate(date),
        due: dueLabel(date, today),
      }
    })
}

export interface SubjectSummary {
  pageCount: number
  totalMinutes: number
  averageUnderstanding: number | null
  lastStudiedAt: string | null
}

// R6: every page under the subject at any depth, regardless of template, with all of its records.
export function subjectSummary(workspace: WorkspaceState, subjectId: string): SubjectSummary {
  const pages = descendantPages(workspace, subjectId)
  const records = pages.flatMap((p) => p.studyRecords)
  const understandingSum = records.reduce((sum, r) => sum + r.understanding, 0)
  return {
    pageCount: pages.length,
    totalMinutes: records.reduce((sum, r) => sum + r.durationMinutes, 0),
    averageUnderstanding: records.length ? Math.round((understandingSum / records.length) * 10) / 10 : null,
    lastStudiedAt: records.reduce<string | null>((latest, r) => (latest === null || r.date > latest ? r.date : latest), null),
  }
}

export interface SubjectPageRow {
  page: StudyPage
  stats: PageStats
}

// Soonest next review first; pages without a review date go last.
export function subjectPageRows(workspace: WorkspaceState, subjectId: string, today: string | null): SubjectPageRow[] {
  return descendantPages(workspace, subjectId)
    .map((page) => ({ page, stats: computePageStats(page, today) }))
    .sort((a, b) => {
      const x = a.stats.nextReviewAt
      const y = b.stats.nextReviewAt
      if (x === y) return 0
      if (x === null) return 1
      if (y === null) return -1
      return x.localeCompare(y)
    })
}


export interface ActivePlan {
  plan: LearningPlan
  targetLabel: string
  targetHref: string | null
  // Study minutes recorded on the plan's target between its start date and today.
  studiedMinutes: number
  // Days from today to the end date (0 = ends today).
  daysLeft: number
}

// Plans whose period includes today, ending soonest first. Progress comes from study records only (no stored goal).
export function activePlans(workspace: WorkspaceState, plans: LearningPlan[], today: string): ActivePlan[] {
  return plans
    .filter((plan) => plan.startDate <= today && today <= plan.endDate)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .map((plan) => {
      const { target } = plan
      let pages: StudyPage[] = workspace.pages
      let targetLabel = "전체 학습"
      let targetHref: string | null = null
      if (target.scope === "subject") {
        pages = descendantPages(workspace, target.subjectId)
        targetLabel = workspace.groups.find((g) => g.id === target.subjectId)?.name ?? "삭제된 과목"
        targetHref = `/subject/${target.subjectId}`
      } else if (target.scope === "page") {
        const page = workspace.pages.find((p) => p.id === target.pageId)
        pages = page ? [page, ...descendantPages(workspace, page.id)] : []
        targetLabel = page ? page.title || "제목 없음" : "삭제된 페이지"
        targetHref = page ? `/record/${page.id}` : null
      }
      const studiedMinutes = pages
        .flatMap((p) => p.studyRecords)
        .filter((r) => r.date >= plan.startDate && r.date <= today)
        .reduce((sum, r) => sum + r.durationMinutes, 0)
      return { plan, targetLabel, targetHref, studiedMinutes, daysLeft: daysBetween(today, plan.endDate) }
    })
}
