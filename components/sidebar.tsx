"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  X,
} from "lucide-react"
import type { Category } from "@/lib/types"
import type { StudyPage } from "@/lib/study-pages"
import {
  addGroup,
  childNodes,
  flattenTree,
  renameGroup,
  renamePage,
  useWorkspace,
  type GroupKind,
  type WorkspaceGroup,
} from "@/lib/workspace"
import { RecordItem } from "@/components/sidebar/record-item"
import { GroupActionsMenu } from "@/components/sidebar/group-actions-menu"
import { signOut, useCurrentUser } from "@/lib/auth"
import { resolveTreeAppearance } from "@/lib/templates"
import { dropIndicatorClass, RootDropZone, TreeDndProvider, useTreeDrag } from "@/components/sidebar/tree-dnd"

const mainNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/analytics", label: "학습 분석", icon: BarChart3 },
  { href: "/plan", label: "학습 계획", icon: CalendarRange },
]

interface SidebarProps {
  categories?: Category[]
}

interface TreeContext {
  groups: WorkspaceGroup[]
  pages: StudyPage[]
  order: string[]
  pathname: string
  onPageDeleted: (id: string) => void
}

export function Sidebar(_props: SidebarProps = {}) {
  const user = useCurrentUser()
  const pathname = usePathname()
  const router = useRouter()
  const { groups, pages, order } = useWorkspace()
  const [addingGroup, setAddingGroup] = useState(false)
  // Phones and narrow tablets: the sidebar is a drawer opened from the top bar (md and up: always visible).
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(pathname)
  if (mobileOpen && openedAt !== pathname) {
    // Navigating closes the drawer (state adjusted during render, no effect needed).
    setMobileOpen(false)
  }
  const openDrawer = () => {
    setOpenedAt(pathname)
    setMobileOpen(true)
  }
  const homeActive = pathname === "/"
  const settingsActive = pathname.startsWith("/settings")

  const handleLogout = async () => {
    const result = await signOut()
    if (!result.ok) {
      toast.error("로그아웃하지 못했어요", { description: result.message })
      return
    }
    router.replace("/login")
    router.refresh()
  }

  const ctx: TreeContext = {
    groups,
    pages,
    order,
    pathname,
    onPageDeleted: (id) => {
      if (pathname === `/record/${id}`) router.push("/")
    },
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          className="flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <BookOpen className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">스터디 해요</span>
        </Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 md:hidden" aria-hidden="true" onClick={() => setMobileOpen(false)} />
      )}

    <aside
      id="app-sidebar"
      onKeyDown={(e) => {
        if (e.key === "Escape") setMobileOpen(false)
      }}
      className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-200 md:visible md:sticky md:inset-auto md:top-0 md:z-auto md:h-screen md:w-60 md:max-w-none md:translate-x-0 md:shadow-none ${
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <BookOpen className="size-4" />
        </div>
        <span className="flex-1 text-base font-semibold tracking-tight text-foreground">
          스터디 해요
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="메뉴 닫기"
          className="-mr-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        >
          <X className="size-4" />
        </button>
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
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3" aria-label="내 페이지">
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
          <ul className="mt-1 flex flex-1 flex-col gap-0.5">
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
            {user?.name.charAt(0)}
          </div>
          {user ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5" aria-hidden="true">
              <span className="h-3.5 w-16 rounded bg-muted" />
              <span className="h-3 w-28 rounded bg-muted" />
            </div>
          )}
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
            type="button"
            onClick={handleLogout}
            aria-label="로그아웃"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
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
      onDeleted={() => ctx.onPageDeleted(page.id)}
      onAddSubgroup={() => {
        setOpen(true)
        setAddingSubgroup(true)
      }}
      addChildHref={`/new?parent=${page.id}`}
      expanded={hasChildren ? open : undefined}
      onToggle={hasChildren ? () => setOpen((v) => !v) : undefined}
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
  const [renaming, setRenaming] = useState(false)
  const isEmpty =
    !ctx.groups.some((g) => g.parentId === group.id) && !ctx.pages.some((p) => p.parentId === group.id)
  const isSubject = group.kind === "subject"
  const active = isSubject && ctx.pathname === `/subject/${group.id}`
  const Chevron = open ? ChevronDown : ChevronRight
  const { rowProps, indicator, isDragging } = useTreeDrag(group.id, { allowAfter: !open })
  const dragClass = `relative ${dropIndicatorClass(indicator)} ${isDragging ? "opacity-40" : ""}`
  const hoverAction =
    "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"

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
      <GroupActionsMenu group={group} triggerClassName={hoverAction} onRename={() => setRenaming(true)} />
    </div>
  )
  const KindIcon = isSubject ? BookMarked : Folder

  return (
    <li>
      {renaming ? (
        <GroupRenameInput group={group} icon={KindIcon} onDone={() => setRenaming(false)} />
      ) : isSubject ? (
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
            className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-2 text-sm text-foreground ${active ? "font-medium" : ""}`}
          >
            <KindIcon className="size-3.5 shrink-0 text-indigo-600" aria-hidden="true" />
            <span className="truncate">{group.name}</span>
            <span className="sr-only">(과목)</span>
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
            <KindIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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

function GroupRenameInput({
  group,
  icon: Icon,
  onDone,
}: {
  group: WorkspaceGroup
  icon: typeof Folder
  onDone: () => void
}) {
  const [draft, setDraft] = useState(group.name)
  const commit = () => {
    if (draft.trim() && draft.trim() !== group.name) renameGroup(group.id, draft)
    onDone()
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        autoFocus
        value={draft}
        aria-label={`${group.kind === "subject" ? "과목" : "폴더"} 이름`}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") commit()
          if (e.key === "Escape") onDone()
        }}
        className="min-w-0 flex-1 rounded border border-indigo-300 bg-card px-1.5 py-0.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  )
}

const groupKindOptions: { kind: GroupKind; label: string; hint: string }[] = [
  { kind: "folder", label: "폴더", hint: "묶어서 정리" },
  { kind: "subject", label: "과목", hint: "학습 계획과 통계의 기준(과목 페이지가 생겨요)" },
]

function NewGroupInput({ parentId = null, onDone }: { parentId?: string | null; onDone: () => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<GroupKind>("folder")
  const hint = groupKindOptions.find((o) => o.kind === kind)?.hint

  const commit = () => {
    if (name.trim()) addGroup(name, parentId, kind)
    onDone()
  }

  return (
    <li
      className="flex flex-col gap-1.5 px-1 py-1"
      onBlur={(e) => {
        // Moving focus between the name field and the kind picker shouldn't commit.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit()
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") commit()
          if (e.key === "Escape") onDone()
        }}
        placeholder={kind === "subject" ? "새 과목 이름" : "새 폴더 이름"}
        aria-label="새 그룹 이름"
        className="w-full rounded-md border border-indigo-300 bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <div role="radiogroup" aria-label="그룹 종류" className="flex gap-1">
        {groupKindOptions.map((o) => (
          <button
            key={o.kind}
            type="button"
            role="radio"
            aria-checked={kind === o.kind}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setKind(o.kind)}
            className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
              kind === o.kind
                ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-700"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">{`${kind === "subject" ? "과목" : "폴더"} = ${hint}`}</p>
    </li>
  )
}
