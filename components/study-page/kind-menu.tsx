"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check } from "lucide-react"
import type { PageKind } from "@/lib/study-pages"
import { noteKinds } from "@/lib/templates"
import { setPageKind } from "@/lib/workspace"
import { dialogBackdrop, menuPanel } from "@/components/ui-styles"

// 노트 종류 (D-30, D-42): opened from the note's ⋯ menu. It only changes the kind; the body stays as written (an
// empty body starts like the kind's button on a new note). Kinds are kept in props, so they wait for the props
// column; 빈 노트 is always there.
export function NoteKindMenu({
  pageId,
  kind,
  propsReady,
  anchorRef,
  onClose,
}: {
  pageId: string
  kind: PageKind | null
  propsReady: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: (refocus: boolean) => void
}) {
  return (
    <KindMenu
      anchorRef={anchorRef}
      kind={kind}
      propsReady={propsReady}
      onPick={(next) => {
        onClose(true)
        if (next !== kind) setPageKind(pageId, next)
      }}
      onClose={onClose}
    />
  )
}

function KindMenu({
  anchorRef,
  kind,
  propsReady,
  onPick,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  kind: PageKind | null
  propsReady: boolean
  onPick: (kind: PageKind | null) => void
  onClose: (refocus: boolean) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  // Portaled to <body>: the top bar's backdrop blur would otherwise trap the phone's bottom sheet inside it.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setAnchor({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [anchorRef])

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]:not(:disabled)") ?? [])
  // The latest onClose without re-running the effect below (that would move focus on every parent render).
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (menuRef.current?.contains(target) || target.closest("[data-kind-toggle]")) return
      closeRef.current(false)
    }
    document.addEventListener("mousedown", onDown)
    const checked = menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")
    ;(checked ?? menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitemradio]:not(:disabled)"))?.focus({ preventScroll: true })
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose(true)
      return
    }
    if (e.key === "Tab") {
      onClose(false)
      return
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length
    list[next]?.focus()
  }

  return createPortal(
    <>
      <div className={`fixed inset-0 z-40 bg-scrim/25 md:hidden ${dialogBackdrop}`} aria-hidden="true" />
      <div
        ref={menuRef}
        role="menu"
        aria-label="노트 종류"
        onKeyDown={onKeyDown}
        style={anchor ? ({ "--top": `${anchor.top}px`, "--right": `${anchor.right}px` } as React.CSSProperties) : undefined}
        className={`${menuPanel} fixed inset-x-2 bottom-2 z-50 max-h-[80dvh] overflow-y-auto overscroll-contain p-1.5 md:bottom-auto md:left-auto md:right-[var(--right)] md:top-[var(--top)] md:w-80 md:origin-top-right`}
      >
        <div className="mx-auto mb-1 mt-1 h-1 w-9 rounded-full bg-border md:hidden" aria-hidden="true" />
        <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">종류</p>
        {noteKinds.map((option) => {
          const Icon = option.icon
          const checked = option.kind === kind
          const waits = !propsReady && option.kind !== null
          return (
            <button
              key={option.starterId}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              disabled={waits}
              onClick={() => onPick(option.kind)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-action-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? "bg-accent" : "hover:bg-accent"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{option.name}</span>
                <span className="block text-xs text-muted-foreground">{waits ? "데이터 준비가 끝나면 쓸 수 있어요" : option.does}</span>
              </span>
              {checked && <Check className="size-4 shrink-0 text-action-600" aria-hidden="true" />}
            </button>
          )
        })}
        <p className="px-2.5 pb-1.5 pt-1 text-xs leading-relaxed text-muted-foreground">
          쓴 내용은 그대로 두고 그 종류에 필요한 칸만 더해요.
        </p>
      </div>
    </>,
    document.body,
  )
}
