"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { FileText, Search } from "lucide-react"
import { searchWorkspace, type SearchResult } from "@/lib/search"
import { useWorkspace } from "@/lib/workspace"

// Open state shared by the sidebar box, the phone top bar icon and ⌘K / Ctrl+K anywhere.
let open = false
const listeners = new Set<() => void>()
const setOpen = (next: boolean) => {
  open = next
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const openSearch = () => setOpen(true)

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

// Sidebar trigger: looks like a search field, opens the dialog.
export function SearchTrigger() {
  const [mac, setMac] = useState(false)
  useEffect(() => setMac(isMac()), [])
  return (
    <button
      type="button"
      onClick={openSearch}
      className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left">노트 검색</span>
      <kbd className="rounded border border-border px-1 font-sans text-[11px] text-muted-foreground">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </button>
  )
}

export function SearchDialog() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  if (!isOpen) return null
  return createPortal(<SearchPanel onClose={() => setOpen(false)} />, document.body)
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const workspace = useWorkspace()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const results = searchWorkspace(workspace, query)
  const recent = query.trim() ? [] : workspace.pages.slice(-6).reverse()

  const go = (pageId: string) => {
    onClose()
    router.push(`/record/${pageId}`)
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const count = query.trim() ? results.length : recent.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="노트 검색" className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "Escape") onClose()
              else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                if (count > 0) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + count) % count)
              } else if (e.key === "Enter") {
                e.preventDefault()
                const id = query.trim() ? results.at(active)?.pageId : recent.at(active)?.id
                if (id) go(id)
              }
            }}
            placeholder="제목, 내용, 핵심 개념으로 찾기 (초성도 돼요: ㅎㅅ)"
            aria-label="검색어"
            className="h-12 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">Esc</kbd>
        </div>

        <ul ref={listRef} role="listbox" aria-label="검색 결과" className="max-h-[50vh] overflow-y-auto p-1.5">
          {query.trim() === "" ? (
            <>
              <li className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">최근 페이지</li>
              {recent.map((page, i) => (
                <ResultRow key={page.id} index={i} active={i === active} onHover={setActive} onPick={() => go(page.id)}>
                  <span className="truncate text-sm text-foreground">{page.title || "제목 없음"}</span>
                </ResultRow>
              ))}
            </>
          ) : results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">“{query.trim()}”이 들어간 노트가 없어요</li>
          ) : (
            results.map((r, i) => (
              <ResultRow key={r.pageId} index={i} active={i === active} onHover={setActive} onPick={() => go(r.pageId)}>
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{r.title}</span>
                    {r.path && <span className="truncate text-xs text-muted-foreground">{r.path}</span>}
                  </span>
                  {r.field !== "제목" && (
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="mr-1.5 text-foreground/70">{r.field}</span>
                      <Highlight result={r} />
                    </span>
                  )}
                </span>
              </ResultRow>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

function ResultRow({
  index,
  active,
  onHover,
  onPick,
  children,
}: {
  index: number
  active: boolean
  onHover: (i: number) => void
  onPick: () => void
  children: React.ReactNode
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseMove={() => onHover(index)}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${active ? "bg-accent" : ""}`}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {children}
    </li>
  )
}

function Highlight({ result }: { result: SearchResult }) {
  if (!result.match) return <>{result.snippet}</>
  const [a, b] = result.match
  return (
    <>
      {result.snippet.slice(0, a)}
      <mark className="rounded-sm bg-amber-100 px-0.5 text-foreground">{result.snippet.slice(a, b)}</mark>
      {result.snippet.slice(b)}
    </>
  )
}
