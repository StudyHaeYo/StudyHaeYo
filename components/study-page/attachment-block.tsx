"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Download, Eye, File, FileText, ExternalLink, X } from "lucide-react"
import { formatFileSize, previewKind } from "@/lib/attachments"
import type { AttachmentBlock } from "@/lib/study-pages"

interface AttachmentBlockViewProps {
  block: AttachmentBlock
  onRemove: () => void
}

export function AttachmentBlockView({ block, onRemove }: AttachmentBlockViewProps) {
  const [viewing, setViewing] = useState(false)
  const kind = previewKind(block.mime)

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${block.name} 첨부 삭제`}
      title="첨부 삭제"
      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
    >
      <X className="size-4" />
    </button>
  )

  return (
    <div className="group relative py-1">
      {block.type === "image" && kind === "image" ? (
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label={`${block.name} 크게 보기`}
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted"
        >
          {/* Object/blob URLs can't go through next/image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.name} className="mx-auto block h-auto max-w-full" />
        </button>
      ) : (
        <FileCard block={block} pdf={kind === "pdf"} onPreview={() => setViewing(true)} />
      )}
      {removeButton}

      {viewing && (
        <AttachmentViewer block={block} pdf={kind === "pdf"} onClose={() => setViewing(false)} />
      )}
    </div>
  )
}

function FileCard({ block, pdf, onPreview }: { block: AttachmentBlock; pdf: boolean; onPreview: () => void }) {
  const Icon = pdf ? FileText : File
  const actionClass =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 pr-12">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
          pdf ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{block.name}</span>
        <span className="text-xs text-muted-foreground">
          {pdf ? "PDF" : block.mime.split("/")[1]?.toUpperCase() || "파일"} · {formatFileSize(block.size)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {pdf && (
          <button type="button" onClick={onPreview} className={actionClass}>
            <Eye className="size-3.5" aria-hidden="true" />
            미리보기
          </button>
        )}
        <a href={block.url} target="_blank" rel="noopener noreferrer" className={actionClass}>
          <ExternalLink className="size-3.5" aria-hidden="true" />
          열기
        </a>
        <a href={block.url} download={block.name} className={actionClass}>
          <Download className="size-3.5" aria-hidden="true" />
          다운로드
        </a>
      </div>
    </div>
  )
}

function AttachmentViewer({ block, pdf, onClose }: { block: AttachmentBlock; pdf: boolean; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={block.name}
        className={`flex max-h-full flex-col overflow-hidden rounded-xl bg-card shadow-xl ${pdf ? "h-[85vh] w-full max-w-4xl" : "max-w-5xl"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <span className="truncate text-sm font-medium text-foreground">{block.name}</span>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="닫기"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {pdf ? (
          <iframe src={block.url} title={`${block.name} 미리보기`} className="min-h-0 w-full flex-1 bg-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.url} alt={block.name} className="max-h-[80vh] max-w-full object-contain" />
        )}
      </div>
    </div>,
    document.body,
  )
}
