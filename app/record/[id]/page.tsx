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
  const query = await searchParams

  // The card review that used to open inside the note is the 복습 화면 now (D-34); old links still land there.
  if (query.mode === "review") redirect(`/review?page=${encodeURIComponent(id)}`)

  if (id === "new") {
    const subject = typeof query.subject === "string" ? query.subject : ""
    redirect(subject ? `/new?subject=${encodeURIComponent(subject)}` : "/new")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 md:h-screen md:overflow-y-auto print:h-auto print:overflow-visible">
        <StudyPageView
          key={id}
          pageId={id}
          focusBlock={typeof query.block === "string" ? query.block : undefined}
          openAi={query.ai === "1"}
          startTyping={query.new === "1"}
        />
      </main>
    </div>
  )
}
