import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { reviewQueue } from "@/lib/learning-os"

export function ReviewQueue({ title = "복습이 필요한 학습" }: { title?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-indigo-600" />
          <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {reviewQueue.length}개
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {reviewQueue.map((item) => (
          <li key={item.id}>
            <Link
              href={`/record/${item.pageId}`}
              className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-card-foreground">{item.topic}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.subject} · 마지막 학습 {item.lastStudied} · 이해도 {item.understanding}/5
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
