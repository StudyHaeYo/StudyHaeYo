import { Sidebar } from "@/components/sidebar"
import { RecordsJournal } from "@/components/records/records-journal"

export const metadata = { title: "학습 기록 · 스터디 해요" }

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?note=<id>[,<id>…]: one note's records (the note's [기록]) or a 시험 정리's scope notes ([범위 기록], D-36).
  const { note } = await searchParams
  const noteIds = typeof note === "string" ? note.split(",").filter(Boolean) : []
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:h-screen md:overflow-y-auto lg:px-10 lg:py-8">
        <RecordsJournal noteIds={noteIds} />
      </main>
    </div>
  )
}
