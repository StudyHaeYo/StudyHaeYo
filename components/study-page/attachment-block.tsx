"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Download, Eye, File, FileText, ExternalLink, FileWarning, PenLine, X } from "lucide-react"
import { downloadAttachment, formatFileSize, previewKind, useAttachmentUrl } from "@/lib/attachments"
import type { AttachmentBlock } from "@/lib/study-pages"
import { PdfAnnotator } from "@/components/study-page/pdf-annotator"

interface AttachmentBlockViewProps {
  block: AttachmentBlock
  onRemove: () => void
  // Saves PDF notes (annotations). Without it the PDF opens read-only in the plain viewer.
  onChange?: (block: AttachmentBlock) => void
}

export function AttachmentBlockView({ block, onRemove, onChange }: AttachmentBlockViewProps) {
  const [viewing, setViewing] = useState(false)
  const kind = previewKind(block.mime)
  const source = useAttachmentUrl(block)

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${block.name} 첨부 삭제`}
      title="첨부 삭제"
      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 [@media(hover:none)]:opacity-100 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
    >
      <X className="size-4" />
    </button>
  )

  return (
    <div className="group relative py-1">
      {source.status === "missing" ? (
        <MissingCard block={block} />
      ) : source.status === "loading" ? (
        <div
          className={`animate-pulse rounded-lg border border-border bg-muted ${block.type === "image" ? "h-48" : "h-16"}`}
          aria-label={`${block.name} 불러오는 중`}
        />
      ) : block.type === "image" && kind === "image" ? (
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label={`${block.name} 크게 보기`}
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-border bg-muted"
        >
          {/* Object/blob URLs can't go through next/image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source.url} alt={block.name} className="mx-auto block h-auto max-w-full" />
        </button>
      ) : (
        <FileCard
          block={block}
          url={source.url}
          pdf={kind === "pdf"}
          annotatable={onChange !== undefined}
          onPreview={() => setViewing(true)}
        />
      )}
      {removeButton}

      {viewing && source.url && kind === "pdf" && onChange ? (
        <PdfAnnotator block={block} url={source.url} onChange={onChange} onClose={() => setViewing(false)} />
      ) : viewing && source.url ? (
        <AttachmentViewer block={block} url={source.url} pdf={kind === "pdf"} onClose={() => setViewing(false)} />
      ) : null}
    </div>
  )
}

// Attached before files were saved to the server (or the stored file is gone): only removable.
function MissingCard({ block }: { block: AttachmentBlock }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 pr-12">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileWarning className="size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-muted-foreground">{block.name}</span>
        <span className="text-xs text-muted-foreground">저장되지 않은 파일이라 열 수 없어요. 지우고 다시 올려 주세요.</span>
      </div>
    </div>
  )
}

function FileCard({
  block,
  url,
  pdf,
  annotatable,
  onPreview,
}: {
  block: AttachmentBlock
  url: string
  pdf: boolean
  annotatable: boolean
  onPreview: () => void
}) {
  const notedPages = Object.keys(block.annotations ?? {}).length
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
          {notedPages > 0 && <span className="text-indigo-600"> · 필기 {notedPages}쪽</span>}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {pdf && annotatable ? (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <PenLine className="size-3.5" aria-hidden="true" />
            보기·필기
          </button>
        ) : (
          pdf && (
            <button type="button" onClick={onPreview} className={actionClass}>
              <Eye className="size-3.5" aria-hidden="true" />
              미리보기
            </button>
          )
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className={actionClass}>
          <ExternalLink className="size-3.5" aria-hidden="true" />
          열기
        </a>
        <button type="button" onClick={() => void downloadAttachment(block)} className={actionClass}>
          <Download className="size-3.5" aria-hidden="true" />
          다운로드
        </button>
      </div>
    </div>
  )
}

function AttachmentViewer({
  block,
  url,
  pdf,
  onClose,
}: {
  block: AttachmentBlock
  url: string
  pdf: boolean
  onClose: () => void
}) {
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
          <iframe src={url} title={`${block.name} 미리보기`} className="min-h-0 w-full flex-1 bg-muted" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={block.name} className="max-h-[80vh] max-w-full object-contain" />
        )}
      </div>
    </div>,
    document.body,
  )
}
