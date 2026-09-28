"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"

interface ConfirmDeleteModalProps {
  open: boolean
  title: string
  note?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({ open, title, note, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="size-5" />
        </div>
        <h2 id="delete-modal-title" className="mt-4 text-base font-semibold text-foreground">
          정말 삭제하시겠어요?
        </h2>
        <p id="delete-modal-desc" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{`"${title}"`}</span> 페이지를 삭제합니다.
          이 작업은 되돌릴 수 없습니다.
        </p>
        {note && <p className="mt-2 text-sm leading-relaxed text-destructive">{note}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
          >
            삭제
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
