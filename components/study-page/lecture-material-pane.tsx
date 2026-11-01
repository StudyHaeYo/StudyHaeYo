"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Maximize2, Sparkles, X } from "lucide-react"
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf"
import { useAttachmentUrl } from "@/lib/attachments"
import type { AttachmentBlock } from "@/lib/study-pages"
import { PdfAnnotator } from "@/components/study-page/pdf-annotator"

// 강의 노트 (D-27): the lecture PDF beside the note — right side on a wide screen (same slot as the AI panel),
// full screen on a phone with a button back to the note. Read-only; pen notes still open from the PDF block.
export function LectureMaterialPane({
  block,
  open,
  onClose,
  onChange,
  onExtractConcepts,
}: {
  block: AttachmentBlock
  open: boolean
  onClose: () => void
  // Saves pen notes from the full-screen reader into the PDF block.
  onChange: (block: AttachmentBlock) => void
  onExtractConcepts: () => void
}) {
  const source = useAttachmentUrl(block)
  const [full, setFull] = useState(false)

  return (
    <aside
      aria-label="강의 자료"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.nativeEvent.isComposing) {
          e.stopPropagation()
          onClose()
        }
      }}
      className={`fixed inset-0 z-40 flex-col print:hidden ${open ? "flex" : "hidden"} bg-card md:inset-y-0 md:left-auto md:w-[min(48vw,720px)] md:border-l md:border-border md:shadow-xl`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground" title={block.name}>
          {block.name}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onExtractConcepts}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            AI로 핵심 개념 뽑기
          </button>
          <button
            type="button"
            onClick={() => setFull(true)}
            disabled={source.status !== "ready"}
            aria-label="크게 보고 필기하기"
            title="크게 보고 필기하기"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="강의 자료 닫기"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {source.status === "ready" && source.url ? (
        open && <PdfPages url={source.url} />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {source.status === "missing" ? "파일을 찾지 못했어요. 본문에서 PDF를 다시 올려 주세요." : "불러오는 중…"}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="m-3 mt-0 rounded-lg border border-border py-2 text-sm font-medium text-foreground md:hidden"
      >
        노트로 돌아가기
      </button>
      {full && source.url && (
        <PdfAnnotator block={block} url={source.url} onChange={onChange} onClose={() => setFull(false)} />
      )}
    </aside>
  )
}

function PdfPages({ url }: { url: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let close: (() => void) | null = null
    openPdf(url)
      .then((opened) => {
        close = opened.close
        if (cancelled) opened.close()
        else setDoc(opened.doc)
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      close?.()
    }
  }, [url])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-3 py-3">
      {error ? (
        <p className="text-sm text-red-600">PDF를 열지 못했어요.</p>
      ) : !doc || width === 0 ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          PDF 여는 중…
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} width={width} />
          ))}
        </div>
      )}
    </div>
  )
}

// Renders when it comes near the viewport, so a long deck doesn't draw every page at once.
function PdfPage({ doc, pageNumber, width }: { doc: PDFDocumentProxy; pageNumber: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = useState(1.414)
  const [visible, setVisible] = useState(pageNumber <= 2)

  useEffect(() => {
    const el = canvasRef.current
    if (!el || visible) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: "600px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    void doc.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: (width / base.width) * dpr })
      const canvas = canvasRef.current
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const render = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport })
      task = render
      render.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, width, visible])

  return (
    <canvas
      ref={canvasRef}
      aria-label={`${pageNumber}쪽`}
      className="block w-full rounded bg-white shadow-sm"
      style={{ aspectRatio: `1 / ${ratio}` }}
    />
  )
}
