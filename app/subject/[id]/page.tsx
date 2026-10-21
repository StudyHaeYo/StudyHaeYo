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

      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <SubjectView key={id} subjectId={id} />
      </main>
    </div>
  )
}
