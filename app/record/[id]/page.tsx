import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { StudyPageView } from "@/components/study-page/study-page-view"

export default async function StudyPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params

  if (id === "new") {
    const query = await searchParams
    const subject = typeof query.subject === "string" ? query.subject : ""
    redirect(subject ? `/new?subject=${subject}` : "/new")
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="h-screen flex-1 overflow-y-auto">
        <StudyPageView key={id} pageId={id} />
      </main>
    </div>
  )
}
