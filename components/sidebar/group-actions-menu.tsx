"use client"

import { useEffect, useRef, useState } from "react"
import { BookMarked, Folder, Lock, MoreHorizontal } from "lucide-react"
import { setGroupKind, type WorkspaceGroup } from "@/lib/workspace"
import { plansTargetingSubject, usePlans } from "@/lib/plans"
import { menuItemClass } from "@/components/page-actions-menu"

export function GroupActionsMenu({ group, triggerClassName }: { group: WorkspaceGroup; triggerClassName: string }) {
  const plans = usePlans()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isSubject = group.kind === "subject"
  const blockingPlans = isSubject ? plansTargetingSubject(plans, group.id).length : 0

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${group.name} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${triggerClassName} ${open ? "opacity-100" : ""}`}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${group.name} 메뉴`}
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {blockingPlans > 0 ? (
            <div role="menuitem" aria-disabled="true" tabIndex={-1} className="flex items-start gap-2 px-2 py-1.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs leading-relaxed text-muted-foreground">
                {`이 과목을 대상으로 한 학습 계획이 ${blockingPlans}개 있어서 폴더로 바꿀 수 없어요. 계획을 먼저 삭제해 주세요.`}
              </span>
            </div>
          ) : (
            <button
              role="menuitem"
              type="button"
              className={`${menuItemClass} text-foreground`}
              onClick={() => {
                setOpen(false)
                setGroupKind(group.id, isSubject ? "folder" : "subject")
              }}
            >
              {isSubject ? (
                <Folder className="size-4 text-muted-foreground" />
              ) : (
                <BookMarked className="size-4 text-muted-foreground" />
              )}
              {isSubject ? "폴더로 바꾸기" : "과목으로 바꾸기"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
