import { Sidebar } from "@/components/sidebar"
import { RecordsJournal } from "@/components/records/records-journal"

export const metadata = { title: "학습 기록 · 스터디 해요" }

export default function RecordsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:h-screen md:overflow-y-auto lg:px-10 lg:py-8">
        <RecordsJournal />
      </main>
    </div>
  )
}
