import { Sidebar } from "@/components/sidebar"
import { ReviewScreen } from "@/components/review/review-screen"

export const metadata = { title: "복습 · 스터디 해요" }

// 복습 화면 (D-34): /review = every note due today, /review?page=<id> = one note. Inside the app, sidebar kept.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const pageId = typeof query.page === "string" ? query.page : undefined
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">
        <ReviewScreen key={pageId ?? "today"} pageId={pageId} />
      </main>
    </div>
  )
}
