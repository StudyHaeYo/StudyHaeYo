import { PageShell } from "@/components/page-shell"
import { RecordsJournal } from "@/components/records/records-journal"

export const metadata = { title: "학습 기록 · 스터디 해요" }

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?note=<id>[,<id>…]: one note's records (the note's [기록]) or a 시험 정리's scope notes ([범위 기록], D-36).
  const { note } = await searchParams
  const noteIds = typeof note === "string" ? note.split(",").filter(Boolean) : []
  return (
    <PageShell>
      <RecordsJournal noteIds={noteIds} />
    </PageShell>
  )
}
