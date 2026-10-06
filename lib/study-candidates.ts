import { addDays, computePageStats, type PageStatus } from "@/lib/study-pages"
import { isReviewCandidate } from "@/lib/templates"
import { nearestSubject, type WorkspaceState } from "@/lib/workspace"

export interface StudyCandidate {
  pageId: string
  topic: string
  subject: string
  status: PageStatus
  understanding: number | null
  lastStudied: string
  due: "오늘" | "내일"
  overdue: boolean
}

function daysBetween(fromISO: string, toISO: string) {
  const [fy, fm, fd] = fromISO.split("-").map(Number)
  const [ty, tm, td] = toISO.split("-").map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

function relativeDay(iso: string | null, today: string) {
  if (!iso) return "기록 없음"
  const diff = daysBetween(iso, today)
  if (diff <= 0) return "오늘"
  if (diff === 1) return "어제"
  return `${diff}일 전`
}

// Pages due for review today or tomorrow. Only pages whose template is studyMode "locked-on"
// are candidates; "optional" pages (even with study on) are left out of these Home widgets.
export function reviewCandidates(workspace: WorkspaceState, today: string): StudyCandidate[] {
  const tomorrow = addDays(today, 1)
  return workspace.pages
    .filter(isReviewCandidate)
    .map((page) => ({ page, stats: computePageStats(page, today) }))
    .filter(({ stats }) => {
      if (stats.status === "완료") return false
      if (stats.status === "복습 필요") return true
      return stats.nextReviewAt !== null && stats.nextReviewAt <= tomorrow
    })
    .sort(
      (a, b) =>
        (a.stats.nextReviewAt ?? today).localeCompare(b.stats.nextReviewAt ?? today) ||
        (a.stats.understanding ?? 0) - (b.stats.understanding ?? 0),
    )
    .map(({ page, stats }) => {
      const dueAt = stats.nextReviewAt ?? today
      return {
        pageId: page.id,
        topic: page.title || "제목 없음",
        subject: nearestSubject(workspace, page.parentId)?.name ?? "내 페이지",
        status: stats.status,
        understanding: stats.understanding,
        lastStudied: relativeDay(stats.lastStudiedAt, today),
        due: dueAt <= today ? "오늘" : "내일",
        overdue: dueAt < today,
      }
    })
}
