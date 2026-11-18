"use client"

import Link from "next/link"
import { weakAreas } from "@/lib/study-stats"
import { useWorkspace } from "@/lib/workspace"

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground text-pretty">{children}</p>
}

export function WeakAreas() {
  const items = weakAreas(useWorkspace())
  return (
    <Panel title="취약 학습 영역">
      {items.length === 0 ? (
        <Empty>이해도가 낮거나 헷갈린 점이 남은 노트가 없어요.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.pageId}>
              <Link
                href={`/record/${item.pageId}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-card-foreground">{item.pageTitle}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.subject}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {item.unresolved > 0 && (
                    <span className="font-medium text-attention-700">{`헷갈린 점 ${item.unresolved}개 남음`}</span>
                  )}
                  <span className="text-muted-foreground">
                    {item.understanding === null ? "이해도 -" : `이해도 ${item.understanding}/5`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
