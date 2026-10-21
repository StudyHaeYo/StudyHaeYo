"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookText, Plus } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { categories } from "@/lib/dummy-data"

export default function NotesPage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<string>()

  // Flatten categories into a simple note-list scaffold (all empty for now).
  const noteGroups = categories.flatMap((c) =>
    c.children?.length
      ? c.children.map((child) => ({ id: child.id, name: child.name }))
      : [{ id: c.id, name: c.name }],
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                학습 노트
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                카테고리별로 정리한 학습 노트를 모아보세요.
              </p>
            </div>
            <button
              onClick={() => router.push("/new")}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus className="size-4" />새 노트
            </button>
          </header>

          <div className="space-y-3">
            {noteGroups.map((group) => (
              <section
                key={group.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <h2 className="mb-3 text-sm font-medium text-card-foreground">
                  {group.name}
                </h2>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <BookText className="size-4" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    아직 작성된 노트가 없습니다.
                  </p>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
