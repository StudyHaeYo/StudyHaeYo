"use client"

import Link from "next/link"
import { CalendarRange } from "lucide-react"
import { TagEditor } from "@/components/study-page/page-properties"
import { type StudyPage } from "@/lib/study-pages"
import { activePlans } from "@/lib/study-stats"
import { noteIcon } from "@/lib/templates"
import { nodePath, updatePage, useWorkspace } from "@/lib/workspace"
import { usePlans } from "@/lib/plans"

// The end of every note: what the note itself is filed under, in a thin strip — where it is used (시험 범위 ·
// 진행 중인 계획) and its tags. Its study records are not part of the note; they open from the top bar (D-36).
export function PageFooter({ page, today }: { page: StudyPage; today: string | null }) {
  const workspace = useWorkspace()
  const plans = usePlans()

  // Where this note is used: exams that have it in scope, and plans running today that its study counts toward.
  const exams = workspace.pages.filter((p) => p.id !== page.id && (p.props?.scope ?? []).includes(page.id))
  const ancestorIds = new Set(nodePath(workspace, page.parentId).map((n) => n.id))
  const plansHere = today
    ? activePlans(workspace, plans, today).filter(({ plan }) => {
        const t = plan.target
        if (t.scope === "subject") return ancestorIds.has(t.subjectId)
        if (t.scope === "page") return t.pageId === page.id || ancestorIds.has(t.pageId)
        return false
      })
    : []

  return (
    <section aria-label="노트 정보" className="flex flex-col border-t border-border">
      {(exams.length > 0 || plansHere.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border py-3 text-sm">
          <span className="w-20 shrink-0 text-muted-foreground">들어간 곳</span>
          {exams.map((exam) => {
            const Icon = noteIcon(exam)
            return (
              <Link
                key={exam.id}
                href={`/record/${exam.id}`}
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{exam.title || "제목 없음"} 범위</span>
              </Link>
            )
          })}
          {plansHere.slice(0, 2).map(({ plan }) => (
            <Link
              key={plan.id}
              href="/plan"
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 font-medium text-foreground transition-colors hover:bg-accent"
            >
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{plan.title} 계획</span>
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 py-3 text-sm">
        <span className="w-20 shrink-0 text-muted-foreground">태그</span>
        <TagEditor tags={page.tags} onChange={(tags) => updatePage(page.id, (p) => ({ ...p, tags }))} />
      </div>
    </section>
  )
}
