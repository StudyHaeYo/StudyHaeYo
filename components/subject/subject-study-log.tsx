"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { openQuickRecord } from "@/components/record/quick-record-dialog"
import { RecordRow } from "@/components/record/record-row"
import { formatDate } from "@/lib/study-pages"
import { allRecordEntries } from "@/lib/study-stats"
import { descendantGroups, useSubjectRecordsReady, useWorkspace } from "@/lib/workspace"
import { SectionHeader, secondaryButton } from "@/components/page-shell"

const LIMIT = 20

// 학습 기록 of a subject: every record in it, newest first — those on its notes (linked, open the note) and those
// left on the subject without a note (edit here, and link to a note later).
export function SubjectStudyLog({ subjectId }: { subjectId: string }) {
  const workspace = useWorkspace()
  const ready = useSubjectRecordsReady()
  const ids = new Set([subjectId, ...descendantGroups(workspace, subjectId).map((g) => g.id)])
  const entries = allRecordEntries(workspace)
    .filter((e) => e.subjectId !== null && ids.has(e.subjectId))
    .sort((a, b) => b.record.date.localeCompare(a.record.date) || (b.record.createdAt ?? 0) - (a.record.createdAt ?? 0))

  return (
    <section aria-labelledby="subject-log-title" className="flex flex-col gap-1">
      <SectionHeader
        id="subject-log-title"
        title="학습 기록"
        count={entries.length}
        action={
          ready && (
            <button type="button" onClick={() => openQuickRecord({ subjectId })} className={secondaryButton}>
              <Plus />
              기록 남기기
            </button>
          )
        }
      />

      {entries.length === 0 ? (
        <p className="border-y border-border py-5 text-sm leading-relaxed text-muted-foreground">
          {ready
            ? "아직 기록이 없어요. 공부를 마치면 [기록 남기기]로 남겨요. 노트를 열고 누르면 그 노트에, 여기서 누르면 이 과목에 남아요."
            : "아직 기록이 없어요. 노트를 열고 [기록 남기기]로 남겨요."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {entries.slice(0, LIMIT).map((entry) => (
            <li key={entry.record.id}>
              <RecordRow entry={entry} when={formatDate(entry.record.date)} />
            </li>
          ))}
        </ul>
      )}
      {entries.length > LIMIT && (
        <Link href="/records" className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          {`최근 ${LIMIT}개만 보여요 · 학습 기록에서 전체 보기`}
        </Link>
      )}
    </section>
  )
}
