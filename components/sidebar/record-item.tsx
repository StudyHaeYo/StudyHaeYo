"use client"

import { useState, type HTMLAttributes, type ReactNode } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  FolderPlus,
  Plus,
  type LucideIcon,
} from "lucide-react"
import { menuItemClass, PageActionsMenu } from "@/components/page-actions-menu"

export interface SidebarRecord {
  id: string
  title: string
  icon?: LucideIcon
  studyBadge?: boolean
}

function PageIcon({ record }: { record: SidebarRecord }) {
  const Icon = record.icon ?? FileText
  return (
    <span className="relative inline-flex shrink-0">
      <Icon className="size-3.5" aria-hidden="true" />
      {record.studyBadge && (
        <span
          title="학습 기록이 쌓이고 있는 페이지"
          className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-indigo-500 ring-2 ring-sidebar"
        >
          <span className="sr-only">학습 기능 사용 중</span>
        </span>
      )}
    </span>
  )
}

interface RecordItemProps {
  record: SidebarRecord
  active: boolean
  onRename: (title: string) => void
  onDeleted?: () => void
  // Present only when the page has child pages.
  expanded?: boolean
  onToggle?: () => void
  addChildHref?: string
  onAddSubgroup?: () => void
  rowProps?: HTMLAttributes<HTMLDivElement>
  rowClassName?: string
  children?: ReactNode
}

export function RecordItem({
  record,
  active,
  onRename,
  onDeleted,
  expanded,
  onToggle,
  addChildHref,
  onAddSubgroup,
  rowProps,
  rowClassName = "",
  children,
}: RecordItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(record.title)

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== record.title) onRename(next)
    else setDraft(record.title)
    setRenaming(false)
  }

  return (
    <li className="group relative">
      {renaming ? (
        <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1">
          <span className="text-muted-foreground">
            <PageIcon record={record} />
          </span>
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
          {...rowProps}
          className={`relative flex items-center rounded-md transition-colors hover:bg-accent ${
            active || menuOpen ? "bg-accent" : ""
          } ${rowClassName}`}
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
            draggable={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm transition-colors hover:text-foreground ${
              onToggle ? "pl-0.5" : "pl-2"
            } ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            <PageIcon record={record} />
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
          <PageActionsMenu
            pageId={record.id}
            title={record.title}
            onRename={() => {
              setDraft(record.title)
              setRenaming(true)
            }}
            onDeleted={onDeleted}
            onOpenChange={setMenuOpen}
            className="mr-1 shrink-0"
            triggerClassName={(open) =>
              `flex size-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-border hover:text-foreground focus-visible:opacity-100 ${
                open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`
            }
            extraItems={(close) => (
              <>
                {addChildHref && (
                  <Link role="menuitem" href={addChildHref} className={`${menuItemClass} text-foreground`} onClick={close}>
                    <FilePlus className="size-4 text-muted-foreground" />
                    하위 페이지 추가
                  </Link>
                )}
                {onAddSubgroup && (
                  <button
                    role="menuitem"
                    type="button"
                    className={`${menuItemClass} text-foreground`}
                    onClick={() => {
                      close()
                      onAddSubgroup()
                    }}
                  >
                    <FolderPlus className="size-4 text-muted-foreground" />
                    하위 그룹 추가
                  </button>
                )}
              </>
            )}
          />
        </div>
      )}

      {children}
    </li>
  )
}
