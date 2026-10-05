"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { useTodayISO } from "@/hooks/use-today"
import { reviewCandidates } from "@/lib/study-candidates"
import { useWorkspace } from "@/lib/workspace"

export function ReviewQueue({ title = "복습이 필요한 학습" }: { title?: string }) {
  const workspace = useWorkspace()
  const today = useTodayISO()
  const queue = today ? reviewCandidates(workspace, today) : []

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-indigo-600" />
          <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {queue.length}개
        </span>
      </div>
      {today && queue.length === 0 && (
        <p className="px-2 py-2 text-sm text-muted-foreground">복습할 학습 노트가 없어요.</p>
      )}
      <ul className="flex flex-col gap-1">
        {queue.map((item) => (
          <li key={item.pageId}>
            <Link
              href={`/record/${item.pageId}`}
              className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-card-foreground">{item.topic}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.subject} · 마지막 학습 {item.lastStudied}
                  {item.understanding !== null ? ` · 이해도 ${item.understanding}/5` : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`text-xs font-medium ${item.due === "오늘" ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {item.due}
                </span>
                <span className="text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  복습하기
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
