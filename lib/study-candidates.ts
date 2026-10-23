import { addDays, computePageStats, daysBetween, dueLabel, unresolvedConfusionCount, type DueTone, type PageStatus } from "@/lib/study-pages"
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
  return workspace.pages
    .filter(isReviewCandidate)
    .map((page) => ({ page, stats: computePageStats(page, today), unresolved: unresolvedConfusionCount(page) }))
    .filter(({ stats }) => {
      if (stats.status === "완료") return false
      if (stats.status === "복습 필요") return true
      return stats.nextReviewAt !== null && stats.nextReviewAt <= tomorrow
    })
    .sort(
      (a, b) =>
        (a.stats.nextReviewAt ?? today).localeCompare(b.stats.nextReviewAt ?? today) ||
        (a.stats.understanding ?? 0) - (b.stats.understanding ?? 0) ||
        b.unresolved - a.unresolved,
    )
    .map(({ page, stats, unresolved }) => {
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
      }
    })
}
