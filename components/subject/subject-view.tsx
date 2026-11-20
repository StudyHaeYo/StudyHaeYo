"use client"

import Link from "next/link"
import { SearchX } from "lucide-react"
import { PageHeader } from "@/components/page-shell"
import { SubjectSummaryPanel } from "@/components/subject/subject-summary"
import { SubjectRecords } from "@/components/subject/subject-records"
import { SubjectStudyLog } from "@/components/subject/subject-study-log"
import { SubjectPlans } from "@/components/subject/subject-plans"
import { nodePath, useWorkspace } from "@/lib/workspace"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { button } from "@/components/ui-styles"

export function SubjectView({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const dataStatus = useDataStatus()
  const subject = workspace.groups.find((g) => g.id === subjectId && g.kind === "subject")
  useDocumentTitle(subject?.name)

  if (!subject) return dataStatus.phase === "ready" ? <SubjectNotFound /> : <DataStatusView status={dataStatus} />

  const ancestors = nodePath(workspace, subject.id)
    .slice(0, -1)
    .map((n) => n.name)

  return (
    <>
      <PageHeader eyebrow={ancestors.length > 0 ? ancestors.join(" › ") : "과목"} title={subject.name} />
      <div className="flex flex-col gap-10">
        <SubjectSummaryPanel subjectId={subject.id} />
        <SubjectRecords subjectId={subject.id} />
        <SubjectStudyLog subjectId={subject.id} />
        <SubjectPlans subjectId={subject.id} />
      </div>
    </>
  )
}

function SubjectNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-foreground">과목을 찾을 수 없어요</h1>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        삭제되었거나 존재하지 않는 과목이에요.
      </p>
      <Link
        href="/"
        className={button("primary", "md", "mt-2")}
      >
        홈으로 가기
      </Link>
    </div>
  )
}
