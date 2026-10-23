"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FileText } from "lucide-react"
import type { StudyPage } from "@/lib/study-pages"

// 페이지 링크 block: opens another page. The title is looked up live, so a rename shows here too.
export function PageLinkCard({ pageId, pages }: { pageId: string; pages: StudyPage[] }) {
  const page = pages.find((p) => p.id === pageId)
  if (!page) {
    return (
      <p className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
        삭제된 페이지
      </p>
    )
  }
  return (
    <Link
      href={`/record/${page.id}`}
      onMouseDown={(e) => e.stopPropagation()}
      className="group/link inline-flex max-w-full items-center gap-2 rounded-md px-1 py-1 text-base text-foreground transition-colors hover:bg-accent"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate underline decoration-muted-foreground/40 underline-offset-4 group-hover/link:decoration-foreground">
        {page.title || "제목 없음"}
      </span>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

// Search-as-you-type list of pages, shown under the block that "/페이지 링크" was typed in.
export function PageLinkPicker({
  pages,
  onPick,
  onClose,
}: {
  pages: StudyPage[]
  onPick: (pageId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const q = query.trim().toLowerCase()
  const matches = pages.filter((p) => (p.title || "제목 없음").toLowerCase().includes(q)).slice(0, 8)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [onClose])

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-border bg-card p-1 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Escape") {
            e.preventDefault()
            onClose()
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            if (matches.length > 0) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length)
          } else if (e.key === "Enter") {
            e.preventDefault()
            const pick = matches.at(Math.min(active, matches.length - 1))
            if (pick) onPick(pick.id)
          }
        }}
        placeholder="연결할 페이지 이름"
        aria-label="연결할 페이지 검색"
        className="w-full rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <ul role="listbox" aria-label="페이지 목록" className="mt-1 max-h-64 overflow-y-auto">
        {matches.length === 0 ? (
          <li className="px-2.5 py-2 text-sm text-muted-foreground">맞는 페이지가 없어요</li>
        ) : (
          matches.map((page, i) => (
            <li
              key={page.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(page.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                i === active ? "bg-accent text-foreground" : "text-foreground"
              }`}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{page.title || "제목 없음"}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
