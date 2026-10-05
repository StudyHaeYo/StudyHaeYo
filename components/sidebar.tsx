"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Home,
  LogOut,
  Plus,
  Settings,
} from "lucide-react"
import type { Category } from "@/lib/types"
import type { StudyPage } from "@/lib/study-pages"
import {
  addGroup,
  childNodes,
  deletePage,
  duplicatePage,
  flattenTree,
  renamePage,
  useWorkspace,
  type WorkspaceGroup,
} from "@/lib/workspace"
import { RecordItem } from "@/components/sidebar/record-item"
import { resolveTreeAppearance } from "@/lib/templates"
import { dropIndicatorClass, RootDropZone, TreeDndProvider, useTreeDrag } from "@/components/sidebar/tree-dnd"

const mainNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/analytics", label: "학습 분석", icon: BarChart3 },
]

interface SidebarProps {
  categories?: Category[]
  onLogout?: () => void
  user?: { name: string; email: string }
}

interface TreeContext {
  groups: WorkspaceGroup[]
  pages: StudyPage[]
  order: string[]
  pathname: string
  onDeletePage: (id: string) => void
}

export function Sidebar({
  onLogout,
  user = { name: "김학생", email: "student@studyhaeyo.com" },
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { groups, pages, order } = useWorkspace()
  const [addingGroup, setAddingGroup] = useState(false)
  const homeActive = pathname === "/"
  const settingsActive = pathname.startsWith("/settings")

  const ctx: TreeContext = {
    groups,
    pages,
    order,
    pathname,
    onDeletePage: (id) => {
      deletePage(id)
      if (pathname === `/record/${id}`) router.push("/")
    },
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <BookOpen className="size-4" />
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">
          스터디 해요
        </span>
      </div>

      {/* Top: main navigation */}
      <nav className="flex flex-col gap-0.5 px-2 pb-2" aria-label="메인 메뉴">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? homeActive : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-border" />

      {/* Bottom: page tree — scrolls on its own so the sidebar stays fixed */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="내 페이지">
        <div className="flex items-center justify-between px-3 pb-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            내 페이지
          </p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setAddingGroup(true)}
              aria-label="새 그룹"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FolderPlus className="size-4" />
            </button>
            <Link
              href="/new"
              aria-label="새 페이지 (위치 선택)"
              title="새 페이지 (위치 선택)"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-4" />
            </Link>
          </div>
        </div>

        <TreeDndProvider>
          <ul className="mt-1 flex flex-col gap-0.5">
            <TreeChildren parentId={null} ctx={ctx} />
            {addingGroup && <NewGroupInput onDone={() => setAddingGroup(false)} />}
            <RootDropZone />
          </ul>
        </TreeDndProvider>
      </nav>

      {/* User / settings / logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Link
            href="/settings"
            aria-label="설정"
            aria-current={settingsActive ? "page" : undefined}
            className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground ${
              settingsActive ? "bg-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            <Settings className="size-4" />
          </Link>
          <button
            onClick={onLogout}
            aria-label="로그아웃"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function TreeChildren({ parentId, ctx }: { parentId: string | null; ctx: TreeContext }) {
  return (
    <>
      {childNodes(ctx, parentId).map((child) =>
        child.type === "group" ? (
          <GroupNode key={child.group.id} group={child.group} ctx={ctx} />
        ) : (
          <PageNode key={child.page.id} page={child.page} ctx={ctx} />
        ),
      )}
    </>
  )
}

function PageNode({ page, ctx }: { page: StudyPage; ctx: TreeContext }) {
  const [open, setOpen] = useState(true)
  const [addingSubgroup, setAddingSubgroup] = useState(false)
  const nested = flattenTree(ctx, page.id).length
  const hasChildren = nested > 0
  const showChildren = (hasChildren && open) || addingSubgroup
  const { rowProps, indicator, isDragging } = useTreeDrag(page.id, { allowAfter: !showChildren })

  return (
    <RecordItem
      record={{ id: page.id, title: page.title || "제목 없음", ...resolveTreeAppearance(page) }}
      active={ctx.pathname === `/record/${page.id}`}
      onRename={(title) => renamePage(page.id, title)}
      onDuplicate={() => duplicatePage(page.id)}
      onDelete={() => ctx.onDeletePage(page.id)}
      onAddSubgroup={() => {
        setOpen(true)
        setAddingSubgroup(true)
      }}
      addChildHref={`/new?parent=${page.id}`}
      expanded={hasChildren ? open : undefined}
      onToggle={hasChildren ? () => setOpen((v) => !v) : undefined}
      deleteNote={hasChildren ? `하위 항목 ${nested}개도 함께 삭제됩니다.` : undefined}
      rowProps={rowProps}
      rowClassName={`${dropIndicatorClass(indicator)} ${isDragging ? "opacity-40" : ""}`}
    >
      {showChildren && (
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
          <TreeChildren parentId={page.id} ctx={ctx} />
          {addingSubgroup && <NewGroupInput parentId={page.id} onDone={() => setAddingSubgroup(false)} />}
        </ul>
      )}
    </RecordItem>
  )
}

function GroupNode({ group, ctx }: { group: WorkspaceGroup; ctx: TreeContext }) {
  const [open, setOpen] = useState(true)
  const [addingSubgroup, setAddingSubgroup] = useState(false)
  const isEmpty =
    !ctx.groups.some((g) => g.parentId === group.id) && !ctx.pages.some((p) => p.parentId === group.id)
  const isSubject = group.kind === "subject"
  const active = isSubject && ctx.pathname === `/subject/${group.id}`
  const Chevron = open ? ChevronDown : ChevronRight
  const { rowProps, indicator, isDragging } = useTreeDrag(group.id, { allowAfter: !open })
  const dragClass = `relative ${dropIndicatorClass(indicator)} ${isDragging ? "opacity-40" : ""}`
  const hoverAction =
    "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"

  const addButton = (
    <div className="mr-1 flex items-center">
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setAddingSubgroup(true)
        }}
        aria-label={`${group.name}에 하위 그룹`}
        title="하위 그룹 추가"
        className={hoverAction}
      >
        <FolderPlus className="size-3.5" />
      </button>
      <Link
        href={`/new?parent=${group.id}`}
        aria-label={`${group.name}에 새 페이지`}
        title={`${group.name}에 새 페이지`}
        className={hoverAction}
      >
        <Plus className="size-3.5" />
      </Link>
    </div>
  )

  return (
    <li>
      {isSubject ? (
        <div
          {...rowProps}
          className={`group/row flex items-center rounded-md transition-colors hover:bg-accent ${
            active ? "bg-accent" : ""
          } ${dragClass}`}
        >
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${group.name} ${open ? "접기" : "펼치기"}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <Chevron className="size-3.5" />
          </button>
          <Link
            href={`/subject/${group.id}`}
            draggable={false}
            aria-current={active ? "page" : undefined}
            className={`flex-1 truncate py-1.5 pr-2 text-sm text-foreground ${active ? "font-medium" : ""}`}
          >
            {group.name}
          </Link>
          {addButton}
        </div>
      ) : (
        <div {...rowProps} className={`group/row flex items-center rounded-md transition-colors hover:bg-accent ${dragClass}`}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-sm font-medium text-foreground"
          >
            <Chevron className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{group.name}</span>
          </button>
          {addButton}
        </div>
      )}

      {open && (
        <ul className={`mt-0.5 flex flex-col gap-0.5 ${isSubject ? "pl-6" : "pl-4"}`}>
          {isEmpty && !addingSubgroup ? (
            <li>
              <Link
                href={`/new?parent=${group.id}`}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" />새 페이지
              </Link>
            </li>
          ) : (
            <TreeChildren parentId={group.id} ctx={ctx} />
          )}
          {addingSubgroup && <NewGroupInput parentId={group.id} onDone={() => setAddingSubgroup(false)} />}
        </ul>
      )}
    </li>
  )
}

function NewGroupInput({ parentId = null, onDone }: { parentId?: string | null; onDone: () => void }) {
  const [name, setName] = useState("")

  const commit = () => {
    if (name.trim()) addGroup(name, parentId)
    onDone()
  }

  return (
    <li className="px-1 py-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") commit()
          if (e.key === "Escape") onDone()
        }}
        placeholder="새 그룹 이름"
        aria-label="새 그룹 이름"
        className="w-full rounded-md border border-indigo-300 bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </li>
  )
}
