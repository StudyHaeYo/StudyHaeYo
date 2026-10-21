"use client"

import Link from "next/link"
import { SearchX } from "lucide-react"
import { SubjectHeader } from "@/components/subject/subject-header"
import { SubjectSummaryPanel } from "@/components/subject/subject-summary"
import { SubjectRecords } from "@/components/subject/subject-records"
import { SubjectPlans } from "@/components/subject/subject-plans"
import { nodePath, useWorkspace } from "@/lib/workspace"
import { useDataStatus } from "@/lib/db/sync"
import { DataStatusView } from "@/components/data-status-notice"

export function SubjectView({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const dataStatus = useDataStatus()
  const subject = workspace.groups.find((g) => g.id === subjectId && g.kind === "subject")

  if (!subject) return dataStatus.phase === "ready" ? <SubjectNotFound /> : <DataStatusView status={dataStatus} />

  const ancestors = nodePath(workspace, subject.id)
    .slice(0, -1)
    .map((n) => n.name)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <SubjectHeader ancestors={ancestors} subjectName={subject.name} />
      <SubjectSummaryPanel subjectId={subject.id} />
      <SubjectRecords subjectId={subject.id} />
      <SubjectPlans subjectId={subject.id} />
    </div>
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
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        홈으로 가기
      </Link>
    </div>
  )
}
