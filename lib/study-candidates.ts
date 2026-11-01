import {
  addDays,
  computePageStats,
  daysBetween,
  dueLabel,
  pageKind,
  unresolvedConfusionCount,
  wrongProblems,
  type DueTone,
  type PageStatus,
} from "@/lib/study-pages"
import { isReviewCandidate } from "@/lib/templates"
import { nearestSubject, NO_SUBJECT, type WorkspaceState } from "@/lib/workspace"

export interface StudyCandidate {
  pageId: string
  topic: string
  subject: string
  status: PageStatus
  understanding: number | null
  lastStudied: string
  due: string
  dueTone: DueTone
  unresolvedConfusions: number
  // 오답 노트: problems still wrong.
  wrongProblems: number
  // In the scope of an upcoming exam (시험 정리): "D-3".
  exam: string | null
}

// 시험 정리 (D-27): for every page in the scope of an exam that hasn't happened yet, the latest day its review
// should come (the day before the exam, or today when that has passed). Nothing is saved; it follows the exam date.
export function examDeadlines(workspace: WorkspaceState, today: string) {
  const deadlines = new Map<string, { reviewBy: string; countdown: string }>()
  for (const page of workspace.pages) {
    const examDate = page.props?.examDate
    if (pageKind(page) !== "exam" || !examDate || examDate < today) continue
    const days = daysBetween(today, examDate)
    const reviewBy = days >= 1 ? addDays(examDate, -1) : today
    const countdown = days === 0 ? "D-day" : `D-${days}`
    for (const id of page.props?.scope ?? []) {
      const known = deadlines.get(id)
      if (!known || reviewBy < known.reviewBy) deadlines.set(id, { reviewBy, countdown })
    }
  }
  return deadlines
}

export const reviewHref = (pageId: string) => `/record/${pageId}?mode=review`

function relativeDay(iso: string | null, today: string) {
  if (!iso) return "기록 없음"
  const diff = daysBetween(iso, today)
  if (diff <= 0) return "오늘"
  if (diff === 1) return "어제"
  return `${diff}일 전`
}

// Pages due for review today or tomorrow, among pages with study features on.
// Order: review date → understanding → more unresolved 헷갈린 점 first.
export function reviewCandidates(workspace: WorkspaceState, today: string): StudyCandidate[] {
  const tomorrow = addDays(today, 1)
  const exams = examDeadlines(workspace, today)
  return workspace.pages
    .filter(isReviewCandidate)
    .map((page) => {
      const base = computePageStats(page, today)
      // A review planned after the exam comes forward to the day before it.
      const exam = exams.get(page.id)
      const pulled = exam && (base.nextReviewAt === null || base.nextReviewAt > exam.reviewBy)
      const stats = pulled ? { ...base, nextReviewAt: exam.reviewBy } : base
      return { page, stats, pulled: !!pulled, exam: exam?.countdown ?? null, unresolved: unresolvedConfusionCount(page) }
    })
    .filter(({ stats, pulled }) => {
      if (stats.status === "완료" && !pulled) return false
      if (stats.status === "복습 필요") return true
      return stats.nextReviewAt !== null && stats.nextReviewAt <= tomorrow
    })
    .sort(
      (a, b) =>
        (a.stats.nextReviewAt ?? today).localeCompare(b.stats.nextReviewAt ?? today) ||
        (a.stats.understanding ?? 0) - (b.stats.understanding ?? 0) ||
        b.unresolved - a.unresolved,
    )
    .map(({ page, stats, unresolved, exam }) => {
      const due = dueLabel(stats.nextReviewAt ?? today, today)
      return {
        pageId: page.id,
        topic: page.title || "제목 없음",
        subject: nearestSubject(workspace, page.parentId)?.name ?? NO_SUBJECT,
        status: stats.status,
        understanding: stats.understanding,
        lastStudied: relativeDay(stats.lastStudiedAt, today),
        due: due.label,
        dueTone: due.tone,
        unresolvedConfusions: unresolved,
        wrongProblems: pageKind(page) === "wrong-answers" ? wrongProblems(page.blocks).length : 0,
        exam,
      }
    })
}
