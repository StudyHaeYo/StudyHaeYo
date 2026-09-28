"use client"

import { useMemo, useState } from "react"
import { Bot, FileText, ListChecks, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { records } from "@/lib/dummy-data"

type AiAction = "summary" | "quiz"

export default function AiToolsPage() {
  const [selectedNote, setSelectedNote] = useState(records[0]?.id ?? "")
  const [action, setAction] = useState<AiAction | null>(null)

  const currentNote = useMemo(
    () => records.find((r) => r.id === selectedNote),
    [selectedNote],
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        onLogout={() => console.log("[v0] logout")}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              AI 도구
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              작성한 노트를 선택하고 AI로 요약하거나 문제를 만들어보세요.
            </p>
          </header>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* Left: note selector + actions */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <label
                  htmlFor="note-select"
                  className="mb-2 block text-sm font-medium text-card-foreground"
                >
                  노트 선택
                </label>
                <select
                  id="note-select"
                  value={selectedNote}
                  onChange={(e) => {
                    setSelectedNote(e.target.value)
                    setAction(null)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-indigo-500"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setAction("summary")}
                  className={`flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    action === "summary"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border bg-card text-card-foreground hover:bg-accent"
                  }`}
                >
                  <FileText className="size-4" />
                  요약하기
                </button>
                <button
                  onClick={() => setAction("quiz")}
                  className={`flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    action === "quiz"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border bg-card text-card-foreground hover:bg-accent"
                  }`}
                >
                  <ListChecks className="size-4" />
                  문제 만들기
                </button>
              </div>
            </div>

            {/* Right: result area */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <Sparkles className="size-4 text-indigo-600" />
                <h2 className="text-sm font-medium text-card-foreground">
                  {action === "summary"
                    ? "요약 결과"
                    : action === "quiz"
                      ? "생성된 문제"
                      : "AI 결과"}
                </h2>
                {currentNote && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {currentNote.title}
                  </span>
                )}
              </div>

              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="size-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {action
                    ? "결과가 여기에 표시됩니다."
                    : "왼쪽에서 노트를 선택하고 작업을 골라주세요."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
