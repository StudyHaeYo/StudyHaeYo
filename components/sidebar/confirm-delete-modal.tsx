"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { button, dialogBackdrop, dialogPanel } from "@/components/ui-styles"

// 을 after a final consonant (계획을 · 기록을 · 과목을), 를 after a vowel (노트를 · 폴더를).
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "을" : "를"
}

interface ConfirmDeleteModalProps {
  open: boolean
  title: string
  note?: string
  targetLabel?: string
  // Notes and groups come back from the toast's [되돌리기] for a few seconds (lib/workspace.ts); plans and records don't.
  undoable?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteModal({
  open,
  title,
  note,
  targetLabel = "노트",
  undoable = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 ${dialogBackdrop}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-desc"
        className={`${dialogPanel} w-full max-w-sm p-6`}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="size-5" />
        </div>
        <h2 id="delete-modal-title" className="mt-4 text-base font-semibold text-foreground">
          {`"${title}" ${targetLabel}${objectParticle(targetLabel)} 삭제할까요?`}
        </h2>
        <p id="delete-modal-desc" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {undoable ? "지운 직후 아래 알림의 [되돌리기]로 되살릴 수 있어요." : "지우면 되돌릴 수 없어요."}
        </p>
        {note && <p className="mt-2 text-sm leading-relaxed text-destructive">{note}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={button("secondary")}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={button("danger")}
          >
            삭제
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
