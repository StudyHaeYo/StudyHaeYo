"use client"

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react"
import { isDrawingBlock, isTextBlock, newBlockId, type Block, type BlockType, type TextBlock } from "@/lib/study-pages"
import { createAttachmentBlocks } from "@/lib/attachments"
import { newDrawingBlock } from "@/lib/drawing"
import { AttachmentBlockView } from "@/components/study-page/attachment-block"
import { DrawingBlockView } from "@/components/study-page/drawing-block"

const shortcuts: { prefix: string; type: BlockType }[] = [
  { prefix: "### ", type: "h3" },
  { prefix: "## ", type: "h2" },
  { prefix: "# ", type: "h1" },
  { prefix: "- ", type: "li" },
  { prefix: "* ", type: "li" },
  { prefix: "```", type: "code" },
]

const blockStyles: Record<BlockType, string> = {
  h1: "text-2xl font-bold tracking-tight pt-4",
  h2: "text-xl font-semibold tracking-tight pt-3",
  h3: "text-lg font-semibold pt-1",
  p: "text-base leading-relaxed",
  li: "text-base leading-relaxed",
  code: "rounded-lg bg-muted px-4 py-3 font-mono text-sm leading-relaxed",
}

const placeholders: Record<BlockType, string> = {
  h1: "제목 1",
  h2: "제목 2",
  h3: "제목 3",
  p: "내용을 입력하세요. # 제목, - 목록, ``` 코드",
  li: "목록",
  code: "코드를 입력하세요",
}

const emptyParagraph = (): TextBlock => ({ id: newBlockId(), type: "p", text: "" })

// Inserts attachments or drawings after `afterId` (or at the end). An empty text block at that spot is
// replaced, and a text block is kept after the inserted blocks so typing can continue below them.
function insertBlocks(blocks: Block[], inserted: Block[], afterId: string | null): Block[] {
  let index = afterId ? blocks.findIndex((b) => b.id === afterId) : -1
  if (index === -1) index = blocks.length - 1
  const target = blocks[index]
  const replaceTarget = target !== undefined && isTextBlock(target) && target.text === ""
  const before = blocks.slice(0, replaceTarget ? index : index + 1)
  const after = blocks.slice(index + 1)
  const trailing = after[0] && isTextBlock(after[0]) ? [] : [emptyParagraph()]
  return [...before, ...inserted, ...trailing, ...after]
}

interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  // Heading text → guiding question shown under that heading while its first paragraph is empty.
  sectionHints?: Record<string, string>
  allowAttachments?: boolean
  attachRef?: Ref<AttachmentHandle>
}

export interface AttachmentHandle {
  openPicker: () => void
  insertDrawing: () => void
}

export function BlockEditor({ blocks, onChange, sectionHints, allowAttachments = false, attachRef }: BlockEditorProps) {
  const hintFor = (index: number) => {
    const block = blocks[index]
    const prev = blocks[index - 1]
    if (!sectionHints || !isTextBlock(block) || block.type !== "p" || block.text !== "") return undefined
    if (!prev || !isTextBlock(prev) || prev.type === "p") return undefined
    return sectionHints[prev.text.trim()]
  }
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFocusedId = useRef<string | null>(null)
  // Attachment URLs resolve asynchronously; insert into the latest blocks, not the ones from the event.
  const latest = useRef({ blocks, onChange })
  const [pendingFocus, setPendingFocus] = useState<{ id: string; caret: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // A drawing added from the menu opens straight into edit mode.
  const [autoEditId, setAutoEditId] = useState<string | null>(null)
  const first = blocks[0]
  const isSoleEmptyBlock = blocks.length === 1 && isTextBlock(first) && first.text === ""

  useLayoutEffect(() => {
    latest.current = { blocks, onChange }
  })

  useImperativeHandle(
    attachRef,
    () => ({
      openPicker: () => fileInputRef.current?.click(),
      insertDrawing: () => {
        const drawing = newDrawingBlock()
        const current = latest.current
        current.onChange(insertBlocks(current.blocks, [drawing], lastFocusedId.current))
        lastFocusedId.current = drawing.id
        setAutoEditId(drawing.id)
      },
    }),
    [],
  )

  // Typing anywhere else on the page (title, 핵심 개념, 헷갈린 점) means there is no "last line" in this
  // editor anymore, so menu attachments go to the end of this editor.
  useEffect(() => {
    if (!allowAttachments) return
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || containerRef.current?.contains(target)) return
      if (target.matches("input:not([type=file]):not([type=checkbox]), textarea, [contenteditable=true]")) {
        lastFocusedId.current = null
      }
    }
    document.addEventListener("focusin", handleFocusIn)
    return () => document.removeEventListener("focusin", handleFocusIn)
  }, [allowAttachments])

  useEffect(() => {
    if (!pendingFocus) return
    const el = refs.current.get(pendingFocus.id)
    if (el) {
      el.focus()
      el.setSelectionRange(pendingFocus.caret, pendingFocus.caret)
    }
    setPendingFocus(null)
  }, [pendingFocus])

  const attachFiles = async (files: File[], afterId: string | null) => {
    if (files.length === 0) return
    const created = await createAttachmentBlocks(files)
    if (created.length === 0) return
    const current = latest.current
    current.onChange(insertBlocks(current.blocks, created, afterId))
  }

  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id)
    onChange(next.some(isTextBlock) ? next : [...next, emptyParagraph()])
  }

  const textNeighbor = (index: number, step: -1 | 1) => {
    for (let i = index + step; i >= 0 && i < blocks.length; i += step) {
      const candidate = blocks[i]
      if (isTextBlock(candidate)) return candidate
    }
    return null
  }

  const updateText = (block: TextBlock, raw: string) => {
    let type = block.type
    let text = raw
    if (block.type === "p") {
      const match = shortcuts.find((s) => raw.startsWith(s.prefix))
      if (match) {
        type = match.type
        text = raw.slice(match.prefix.length)
      }
    }
    onChange(blocks.map((b) => (b.id === block.id ? { ...block, type, text } : b)))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: TextBlock, index: number) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const el = e.currentTarget
    const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0

    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault()
      if (block.type === "li" && block.text === "") {
        onChange(blocks.map((b) => (b.id === block.id ? { ...block, type: "p" } : b)))
        return
      }
      const before = block.text.slice(0, el.selectionStart)
      const after = block.text.slice(el.selectionEnd)
      const next: TextBlock = { id: newBlockId(), type: block.type === "li" ? "li" : "p", text: after }
      onChange([...blocks.slice(0, index), { ...block, text: before }, next, ...blocks.slice(index + 1)])
      setPendingFocus({ id: next.id, caret: 0 })
      return
    }

    if (e.key === "Backspace" && caretAtStart) {
      if (block.type !== "p") {
        e.preventDefault()
        onChange(blocks.map((b) => (b.id === block.id ? { ...block, type: "p" } : b)))
        return
      }
      if (index > 0) {
        e.preventDefault()
        const prev = blocks[index - 1]
        // Never merge text into an attachment; move to the text above it instead.
        if (!isTextBlock(prev)) {
          const above = textNeighbor(index, -1)
          if (above) setPendingFocus({ id: above.id, caret: above.text.length })
          return
        }
        onChange([...blocks.slice(0, index - 1), { ...prev, text: prev.text + block.text }, ...blocks.slice(index + 1)])
        setPendingFocus({ id: prev.id, caret: prev.text.length })
      }
      return
    }

    if (e.key === "ArrowUp" && caretAtStart) {
      const above = textNeighbor(index, -1)
      if (above) {
        e.preventDefault()
        setPendingFocus({ id: above.id, caret: above.text.length })
      }
    }
    if (e.key === "ArrowDown" && el.selectionStart === block.text.length) {
      const below = textNeighbor(index, 1)
      if (below) {
        e.preventDefault()
        setPendingFocus({ id: below.id, caret: 0 })
      }
    }
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files")

  const dropHandlers = allowAttachments
    ? {
        onDragOver: (e: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
          if (!dragging) setDragging(true)
        },
        onDragLeave: (e: DragEvent<HTMLDivElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        },
        onDrop: (e: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(e)) return
          e.preventDefault()
          setDragging(false)
          void attachFiles(Array.from(e.dataTransfer.files), lastFocusedId.current)
        },
      }
    : {}

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <div
        {...dropHandlers}
        className={`relative flex flex-col gap-1 rounded-lg transition-colors ${
          dragging ? "bg-indigo-50/60 ring-2 ring-indigo-300 ring-offset-4 ring-offset-background" : ""
        }`}
        aria-label="페이지 본문"
      >
        {blocks.map((block, index) => {
          if (isDrawingBlock(block)) {
            return (
              <DrawingBlockView
                key={block.id}
                block={block}
                autoEdit={autoEditId === block.id}
                onChange={(next) => {
                  const current = latest.current
                  current.onChange(current.blocks.map((b) => (b.id === next.id ? next : b)))
                }}
                onRemove={() => removeBlock(block.id)}
                onActivate={() => {
                  lastFocusedId.current = block.id
                }}
                onNavigate={(step) => {
                  const target = textNeighbor(index, step)
                  if (target) setPendingFocus({ id: target.id, caret: step === -1 ? target.text.length : 0 })
                }}
              />
            )
          }
          if (!isTextBlock(block)) {
            return <AttachmentBlockView key={block.id} block={block} onRemove={() => removeBlock(block.id)} />
          }
          const hint = hintFor(index)
          return (
            <div key={block.id} className="flex items-start gap-2">
              {block.type === "li" && (
                <span aria-hidden="true" className="select-none pt-0.5 text-base leading-relaxed text-muted-foreground">
                  •
                </span>
              )}
              <textarea
                ref={(el) => {
                  if (el) refs.current.set(block.id, el)
                  else refs.current.delete(block.id)
                }}
                id={index === 0 ? "page-body" : undefined}
                aria-label={index === 0 ? "페이지 본문" : undefined}
                value={block.text}
                rows={1}
                spellCheck={false}
                onFocus={() => {
                  lastFocusedId.current = block.id
                }}
                onChange={(e) => updateText(block, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, block, index)}
                onPaste={
                  allowAttachments
                    ? (e) => {
                        const files = Array.from(e.clipboardData.files)
                        if (files.length === 0) return
                        e.preventDefault()
                        void attachFiles(files, block.id)
                      }
                    : undefined
                }
                placeholder={
                  hint ?? (isSoleEmptyBlock ? "자유롭게 학습 내용을 작성해보세요. # 제목, - 목록, ``` 코드" : placeholders[block.type])
                }
                className={`w-full resize-none bg-transparent text-foreground outline-none [field-sizing:content] ${
                  hint || isSoleEmptyBlock
                    ? "placeholder:text-muted-foreground/60"
                    : "placeholder:text-transparent focus:placeholder:text-muted-foreground/50"
                } ${blockStyles[block.type]}`}
              />
            </div>
          )
        })}
        {dragging && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-indigo-700">
            놓으면 첨부돼요 · 파일당 10MB까지
          </p>
        )}
      </div>

      {allowAttachments && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            void attachFiles(files, lastFocusedId.current)
          }}
        />
      )}
    </div>
  )
}
