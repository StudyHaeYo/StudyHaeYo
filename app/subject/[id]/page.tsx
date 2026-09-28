import { notFound } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { SubjectHeader } from "@/components/subject/subject-header"
import { WeeklyGoals } from "@/components/subject/weekly-goals"
import { SubjectRecords } from "@/components/subject/subject-records"
import { findSubject } from "@/lib/study-tree"

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const found = findSubject(id)
  if (!found) notFound()

  const { group, subject } = found

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <SubjectHeader groupName={group.name} subjectName={subject.name} />
          <WeeklyGoals key={subject.id} initialGoals={subject.weeklyGoals} />
          <SubjectRecords subjectId={subject.id} subjectName={subject.name} />
        </div>
      </main>
    </div>
  )
}
