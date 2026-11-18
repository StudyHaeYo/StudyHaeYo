import { PageShell } from "@/components/page-shell"
import { RecordsJournal } from "@/components/records/records-journal"
import { LookBack } from "@/components/records/look-back"

export const metadata = { title: "돌아보기 · 스터디 해요" }

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?note=<id>[,<id>…]: one note's records (the note's ⋯ > 학습 기록) or a 시험 정리's scope notes (D-36, D-42) — the log only.
  const { note } = await searchParams
  const noteIds = typeof note === "string" ? note.split(",").filter(Boolean) : []
  if (noteIds.length > 0)
    return (
      <PageShell>
        <RecordsJournal noteIds={noteIds} />
      </PageShell>
    )
  return (
    <PageShell width="wide">
      <LookBack />
    </PageShell>
  )
}
