import { PageShell } from "@/components/page-shell"
import { SubjectView } from "@/components/subject/subject-view"

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <PageShell>
      <SubjectView key={id} subjectId={id} />
    </PageShell>
  )
}
