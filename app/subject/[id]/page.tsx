import { Sidebar } from "@/components/sidebar"
import { SubjectView } from "@/components/subject/subject-view"

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:h-screen md:overflow-y-auto lg:px-10 lg:py-8">
        <SubjectView key={id} subjectId={id} />
      </main>
    </div>
  )
}
