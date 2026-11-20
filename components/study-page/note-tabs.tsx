"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { closeTab, pruneTabs, useNoteTabs, visitNote } from "@/lib/note-tabs"
import { noteIcon } from "@/lib/templates"
import { useDataStatus } from "@/lib/db/sync"
import { useWorkspace } from "@/lib/workspace"

// 노트 탭 (D-45): the open notes as tabs above the note, on screens wide enough for them (md and up; a phone has the
// sidebar menu instead). Each note opened adds a tab, + makes a new note in one (lib/note-tabs.ts). Switching tabs is
// frequent, so nothing animates.
export function NoteTabs({ pageId }: { pageId: string }) {
  const router = useRouter()
  const tabs = useNoteTabs()
  const workspace = useWorkspace()
  const ready = useDataStatus().phase === "ready"

  useEffect(() => {
    visitNote(pageId)
  }, [pageId])

  // Deleted notes lose their tab (only once the notes have loaded, or every tab would look deleted).
  useEffect(() => {
    if (!ready) return
    const ids = new Set(workspace.pages.map((p) => p.id))
    pruneTabs((id) => ids.has(id))
  }, [ready, workspace.pages])

  // Before the saved tabs are read (server render, first paint) the bar shows just this note.
  const ids = tabs.ids.length > 0 ? tabs.ids : [pageId]
  const active = tabs.ids.length > 0 ? tabs.active : 0
  const byId = new Map(workspace.pages.map((p) => [p.id, p]))

  const navRef = useRef<HTMLElement>(null)
  const close = (index: number) => {
    const next = closeTab(index)
    if (next === null) router.push("/")
    else if (next) router.push(`/record/${next}`)
    // The close button that had focus is gone: keyboard focus goes to the tab now shown (web-design-guidelines).
    setTimeout(() => navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus(), 0)
  }

  return (
    <nav
      ref={navRef}
      aria-label="열린 노트"
      className="sticky top-0 z-30 hidden h-9 items-end gap-1 border-b border-border bg-muted px-2 print:hidden md:flex"
    >
      <ul className="flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {ids.map((id, i) => {
          const page = byId.get(id)
          const title = page?.title || "제목 없음"
          const Icon = page ? noteIcon(page) : null
          const on = i === active
          return (
            <li
              key={id}
              className={`group relative flex h-8 w-44 min-w-24 shrink items-center rounded-t-md text-sm transition-colors ${
                on
                  ? "border border-b-0 border-border bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Link
                href={`/record/${id}`}
                aria-current={on ? "page" : undefined}
                title={title}
                // Middle click on a tab closes it, as in a browser.
                onAuxClick={(e) => {
                  if (e.button !== 1) return
                  e.preventDefault()
                  close(i)
                }}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-t-md pl-2.5 pr-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action-500"
              >
                {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className={`truncate ${on ? "font-medium" : ""}`}>{title}</span>
              </Link>
              <button
                type="button"
                onClick={() => close(i)}
                aria-label={`${title} 탭 닫기`}
                className={`touch-hit mr-1 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-border hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-action-500 ${
                  on ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                }`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <Link
        href="/new"
        aria-label="새 노트"
        title="새 노트"
        className="mb-1 flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-action-500 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  )
}
