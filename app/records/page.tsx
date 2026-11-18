import { PageShell } from "@/components/page-shell"
import { RecordsJournal } from "@/components/records/records-journal"
import { LookBack } from "@/components/records/look-back"

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// One note's records keep their own name in the tab; everything else is 돌아보기.
export async function generateMetadata({ searchParams }: Search) {
  const { note } = await searchParams
  return { title: typeof note === "string" && note ? "학습 기록 · 스터디 해요" : "돌아보기 · 스터디 해요" }
}

export default async function RecordsPage({ searchParams }: Search) {
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
