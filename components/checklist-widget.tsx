"use client"

import { Check, ListTodo } from "lucide-react"
import type { ChecklistItem } from "@/lib/types"

interface ChecklistWidgetProps {
  items: ChecklistItem[]
  onToggle?: (id: string) => void
}

export function ChecklistWidget({ items, onToggle }: ChecklistWidgetProps) {
  const doneCount = items.filter((i) => i.done).length

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <ListTodo className="size-4 text-indigo-600" />
          오늘의 체크리스트
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onToggle?.(item.id)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  item.done
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-border bg-background"
                }`}
              >
                {item.done && <Check className="size-3.5" />}
              </span>
              <span
                className={`text-sm transition-colors ${
                  item.done
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
