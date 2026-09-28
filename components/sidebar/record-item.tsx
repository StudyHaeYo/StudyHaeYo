"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { ConfirmDeleteModal } from "./confirm-delete-modal"

export interface SidebarRecord {
  id: string
  title: string
}

interface RecordItemProps {
  record: SidebarRecord
  active: boolean
  onRename: (title: string) => void
  onDuplicate: () => void
  onDelete: () => void
  // Present only when the page has child pages.
  expanded?: boolean
  onToggle?: () => void
  addChildHref?: string
  deleteNote?: string
  children?: ReactNode
}

export function RecordItem({
  record,
  active,
  onRename,
  onDuplicate,
  onDelete,
  expanded,
  onToggle,
  addChildHref,
  deleteNote,
  children,
}: RecordItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(record.title)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointer = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [menuOpen])

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== record.title) onRename(next)
    else setDraft(record.title)
    setRenaming(false)
  }

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"

  return (
    <li className="group relative">
      {renaming ? (
        <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={draft}
            aria-label="페이지 이름"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") {
                setDraft(record.title)
                setRenaming(false)
              }
            }}
            className="min-w-0 flex-1 rounded border border-indigo-300 bg-card px-1.5 py-0.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      ) : (
        <div
          className={`flex items-center rounded-md transition-colors hover:bg-accent ${
            active || menuOpen ? "bg-accent" : ""
          }`}
        >
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${record.title} ${expanded ? "접기" : "펼치기"}`}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          )}
          <Link
            href={`/record/${record.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm transition-colors hover:text-foreground ${
              onToggle ? "pl-0.5" : "pl-2"
            } ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{record.title}</span>
          </Link>
          {addChildHref && (
            <Link
              href={addChildHref}
              aria-label={`${record.title}에 하위 페이지`}
              title="하위 페이지 추가"
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-border hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Plus className="size-3.5" />
            </Link>
          )}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`${record.title} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-border hover:text-foreground focus-visible:opacity-100 ${
              menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${record.title} 메뉴`}
          className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-foreground`}
            onClick={() => {
              setMenuOpen(false)
              setDraft(record.title)
              setRenaming(true)
            }}
          >
            <Pencil className="size-4 text-muted-foreground" />
            이름 바꾸기
          </button>
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-foreground`}
            onClick={() => {
              setMenuOpen(false)
              onDuplicate()
            }}
          >
            <Copy className="size-4 text-muted-foreground" />
            복제하기
          </button>
          {addChildHref && (
            <Link
              role="menuitem"
              href={addChildHref}
              className={`${menuItemClass} text-foreground`}
              onClick={() => setMenuOpen(false)}
            >
              <FilePlus className="size-4 text-muted-foreground" />
              하위 페이지 추가
            </Link>
          )}
          <div role="separator" className="my-1 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            className={`${menuItemClass} text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`}
            onClick={() => {
              setMenuOpen(false)
              setConfirmOpen(true)
            }}
          >
            <Trash2 className="size-4" />
            삭제하기
          </button>
        </div>
      )}

      {children}

      <ConfirmDeleteModal
        open={confirmOpen}
        title={record.title}
        note={deleteNote}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onDelete()
        }}
      />
    </li>
  )
}
