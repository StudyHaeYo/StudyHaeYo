import { Sidebar } from "@/components/sidebar"
import { NewPageFlow } from "@/components/new-page/new-page-flow"

export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string; subject?: string }>
}) {
  const { parent, subject } = await searchParams
  const contextParentId = parent ?? subject

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-12 lg:px-10">
        <NewPageFlow key={contextParentId ?? "global"} contextParentId={contextParentId} />
      </main>
    </div>
  )
}
