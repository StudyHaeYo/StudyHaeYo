"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Loader2 } from "lucide-react"
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf"
import type { AttachmentBlock, DrawingStroke } from "@/lib/study-pages"
import {
  DrawingToolbar,
  StrokeLayer,
  useStrokeInput,
  useToolState,
  type ToolState,
} from "@/components/study-page/drawing-kit"

type Annotations = Record<string, DrawingStroke[]>

const HISTORY_LIMIT = 100
const MAX_PAGE_WIDTH = 880

// Full-screen PDF reader with pen/highlighter/eraser over each page. Strokes are saved into the
// attachment block (`annotations`), so they stay with the page that holds the PDF.
export function PdfAnnotator({
  block,
  url,
  onChange,
  onClose,
}: {
  block: AttachmentBlock
  url: string
  onChange: (block: AttachmentBlock) => void
  onClose: () => void
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  // Touch screens start with the hand tool so a swipe scrolls; mouse and pen users start drawing.
  const [toolState, setToolState] = useToolState(
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches ? "hand" : "pen",
  )
  const [past, setPast] = useState<{ page: string; strokes: DrawingStroke[] }[]>([])
  const [future, setFuture] = useState<{ page: string; strokes: DrawingStroke[] }[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const latest = useRef(block)

  useLayoutEffect(() => {
    latest.current = block
  })

  useEffect(() => {
    let cancelled = false
    let close: (() => void) | null = null
    openPdf(url)
      .then((opened) => {
        close = opened.close
        if (cancelled) opened.close()
        else setDoc(opened.doc)
      })
      .catch(() => {
        if (!cancelled) setError("PDF를 열지 못했어요. 파일이 손상됐거나 PDF가 아닐 수 있어요.")
      })
    return () => {
      cancelled = true
      close?.()
    }
  }, [url])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.min(Math.floor(entry.contentRect.width), MAX_PAGE_WIDTH))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const pageStrokes = (page: string) => latest.current.annotations?.[page] ?? []

  const setPageStrokes = (page: string, strokes: DrawingStroke[]) => {
    const next: Annotations = { ...(latest.current.annotations ?? {}) }
    if (strokes.length > 0) next[page] = strokes
    else delete next[page]
    const { annotations: _old, ...rest } = latest.current
    latest.current = Object.keys(next).length > 0 ? { ...rest, annotations: next } : rest
    onChange(latest.current)
  }

  const record = (page: string, before: DrawingStroke[]) => {
    setPast((p) => [...p, { page, strokes: before }].slice(-HISTORY_LIMIT))
    setFuture([])
  }

  const undo = () => {
    const last = past[past.length - 1]
    if (!last) return
    setPast(past.slice(0, -1))
    setFuture([{ page: last.page, strokes: pageStrokes(last.page) }, ...future])
    setPageStrokes(last.page, last.strokes)
  }

  const redo = () => {
    const [next, ...rest] = future
    if (!next) return
    setFuture(rest)
    setPast([...past, { page: next.page, strokes: pageStrokes(next.page) }])
    setPageStrokes(next.page, next.strokes)
  }

  const clearCurrent = () => {
    const page = String(currentPage)
    const before = pageStrokes(page)
    if (before.length === 0) return
    record(page, before)
    setPageStrokes(page, [])
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  })

  const annotatedPages = Object.keys(block.annotations ?? {}).length

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${block.name} 필기`} className="fixed inset-0 z-50 flex flex-col bg-muted">
      <header className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{block.name}</p>
            <p className="text-xs text-muted-foreground">
              {doc ? `${currentPage} / ${doc.numPages}쪽` : "불러오는 중"}
              {annotatedPages > 0 ? ` · 필기 ${annotatedPages}쪽` : ""} · 필기는 자동 저장돼요
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Check className="size-4" />
            완료
          </button>
        </div>
        <DrawingToolbar
          state={toolState}
          onState={setToolState}
          withHand
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={clearCurrent}
          clearLabel="이 쪽 필기 지우기"
          canClear={pageStrokes(String(currentPage)).length > 0}
        />
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-6">
        {error ? (
          <p role="alert" className="mx-auto mt-10 max-w-md text-center text-sm text-red-600">
            {error}
          </p>
        ) : !doc || width === 0 ? (
          <p role="status" className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            PDF를 여는 중이에요…
          </p>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-4" style={{ width }}>
            {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((number) => (
              <PdfPage
                key={number}
                doc={doc}
                number={number}
                width={width}
                root={scrollRef}
                strokes={block.annotations?.[String(number)] ?? []}
                toolState={toolState}
                getStrokes={() => pageStrokes(String(number))}
                setStrokes={(strokes) => setPageStrokes(String(number), strokes)}
                onGesture={(before) => record(String(number), before)}
                onCurrent={setCurrentPage}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function PdfPage({
  doc,
  number,
  width,
  root,
  strokes,
  toolState,
  getStrokes,
  setStrokes,
  onGesture,
  onCurrent,
}: {
  doc: PDFDocumentProxy
  number: number
  width: number
  root: React.RefObject<HTMLDivElement | null>
  strokes: DrawingStroke[]
  toolState: ToolState
  getStrokes: () => DrawingStroke[]
  setStrokes: (strokes: DrawingStroke[]) => void
  onGesture: (before: DrawingStroke[]) => void
  onCurrent: (page: number) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Height/width of the PDF page; known after the page loads (A4 portrait until then).
  const [ratio, setRatio] = useState(Math.SQRT2)
  const [near, setNear] = useState(false)
  const [rendered, setRendered] = useState(false)
  const input = useStrokeInput({ enabled: true, toolState, getStrokes, setStrokes, onGesture })
  const height = Math.round(width * ratio)

  // Render only pages near the viewport; long PDFs would otherwise hold every page as a bitmap.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: root.current,
      rootMargin: "800px 0px",
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [root])

  // The page crossing the middle of the viewport is the "current" one (page counter, 이 쪽 지우기).
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onCurrent(number)
      },
      { root: root.current, rootMargin: "-50% 0px -50% 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [root, onCurrent, number])

  useEffect(() => {
    if (!near) return
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<void> } | null = null
    void doc.getPage(number).then((page) => {
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const canvas = canvasRef.current
      const context = canvas?.getContext("2d")
      if (!canvas || !context) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (width * dpr) / base.width })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvas, canvasContext: context, viewport })
      task.promise.then(
        () => !cancelled && setRendered(true),
        () => {},
      )
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, number, width, near])

  const shown = input.draft ? [...strokes, input.draft] : strokes

  return (
    <div
      ref={boxRef}
      className="relative shrink-0 overflow-hidden bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
      style={{ width, height }}
      aria-label={`${number}쪽`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden="true" />
      {!rendered && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{number}쪽</span>
      )}
      <div {...input.handlers} className={`absolute inset-0 ${input.cursor}`} style={{ touchAction: input.touchAction }}>
        <StrokeLayer strokes={shown} />
      </div>
    </div>
  )
}
