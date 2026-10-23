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
import {
  ArrowDown,
  ArrowUp,
  Code,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  Paperclip,
  PenLine,
  Pilcrow,
  Trash2,
} from "lucide-react"
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

// Lines the grip up with the first text line (headings have top padding).
const handleTop: Record<BlockType, string> = {
  h1: "top-[19px]",
  h2: "top-[14px]",
  h3: "top-[6px]",
  p: "top-0.5",
  li: "top-0.5",
  code: "top-2.5",
}

const emptyParagraph = (): TextBlock => ({ id: newBlockId(), type: "p", text: "" })

const markdownPrefix: Record<BlockType, string> = { h1: "# ", h2: "## ", h3: "### ", li: "- ", p: "", code: "" }

// "/" menu: typed at the start of a line, filtered by what follows the slash.
type SlashItem = { label: string; keywords: string; icon: typeof Pilcrow } & (
  | { type: BlockType }
  | { action: "file" | "drawing" }
)

const slashItems: SlashItem[] = [
  { label: "본문", keywords: "본문 텍스트 글 text paragraph", icon: Pilcrow, type: "p" },
  { label: "제목 1", keywords: "제목1 큰제목 heading h1", icon: Heading1, type: "h1" },
  { label: "제목 2", keywords: "제목2 중간제목 heading h2", icon: Heading2, type: "h2" },
  { label: "제목 3", keywords: "제목3 작은제목 heading h3", icon: Heading3, type: "h3" },
  { label: "목록", keywords: "목록 리스트 글머리 list bullet li", icon: List, type: "li" },
  { label: "코드", keywords: "코드 code", icon: Code, type: "code" },
  { label: "그림", keywords: "그림 필기 손글씨 드로잉 drawing draw pen", icon: PenLine, action: "drawing" },
  { label: "파일 첨부", keywords: "파일 첨부 이미지 사진 pdf file image attach", icon: Paperclip, action: "file" },
]

function matchSlash(query: string, allowAttachments: boolean) {
  const q = query.trim().toLowerCase().replace(/\s+/g, "")
  return slashItems.filter(
    (item) =>
      (allowAttachments || !("action" in item)) &&
      (q === "" || item.label.replace(/\s+/g, "").includes(q) || item.keywords.toLowerCase().includes(q)),
  )
}

// Moves blocks[from] so it lands before/after blocks[to].
function moveBlock(blocks: Block[], from: number, to: number, side: "before" | "after"): Block[] {
  let at = side === "before" ? to : to + 1
  if (from < at) at -= 1
  if (at === from) return blocks
  const next = [...blocks]
  const [moved] = next.splice(from, 1)
  next.splice(at, 0, moved)
  return next
}

const BLOCK_DRAG_TYPE = "application/x-studyhaeyo-block"

// Plain text of a block for copying a multi-block selection.
function blockText(block: Block) {
  if (isTextBlock(block)) return block.type === "code" ? "```\n" + block.text + "\n```" : markdownPrefix[block.type] + block.text
  return isDrawingBlock(block) ? "[그림]" : `[첨부] ${block.name}`
}

function blockIndexAt(target: EventTarget | null) {
  const el = (target as HTMLElement | null)?.closest?.("[data-block-index]") as HTMLElement | null
  return el ? Number(el.dataset.blockIndex) : null
}

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
  // Block selection: dragging from one block into another selects whole blocks (each line is its own textarea,
  // so the browser can't select text across them). Copy, cut, Backspace/Delete and Esc act on the selection.
  const [selection, setSelection] = useState<{ anchor: number; focus: number } | null>(null)
  const dragFrom = useRef<number | null>(null)
  // "/" menu for one block; `active` is the highlighted row.
  const [slash, setSlash] = useState<{ blockId: string; active: number } | null>(null)
  // Reordering: the block being dragged by its handle, and where it would land.
  const [moving, setMoving] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<{ index: number; side: "before" | "after" } | null>(null)
  const [handleMenu, setHandleMenu] = useState<string | null>(null)
  const selStart = selection ? Math.min(selection.anchor, selection.focus) : -1
  const selEnd = selection ? Math.max(selection.anchor, selection.focus) : -1
  const isSelected = (index: number) => index >= selStart && index <= selEnd
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
    const endDrag = () => {
      dragFrom.current = null
    }
    document.addEventListener("mouseup", endDrag)
    return () => document.removeEventListener("mouseup", endDrag)
  }, [])

  useEffect(() => {
    if (!selection) return
    const { blocks: current } = latest.current
    const lo = Math.min(selection.anchor, selection.focus)
    const hi = Math.max(selection.anchor, selection.focus)
    const picked = current.slice(lo, hi + 1)
    const removeSelected = () => {
      const next = [...current.slice(0, lo), ...current.slice(hi + 1)]
      const kept = next.some(isTextBlock) ? next : [...next, emptyParagraph()]
      latest.current.onChange(kept)
      setSelection(null)
      const target = kept.slice(Math.max(0, lo - 1)).find(isTextBlock) ?? kept.find(isTextBlock)
      if (target && isTextBlock(target)) setPendingFocus({ id: target.id, caret: target.text.length })
    }
    const writeClipboard = (e: ClipboardEvent) => {
      e.preventDefault()
      e.clipboardData?.setData("text/plain", picked.map(blockText).join("\n"))
    }
    const onCopy = (e: ClipboardEvent) => writeClipboard(e)
    const onCut = (e: ClipboardEvent) => {
      writeClipboard(e)
      removeSelected()
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null)
      else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        removeSelected()
      } else if (!e.metaKey && !e.ctrlKey && !e.shiftKey) setSelection(null)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setSelection(null)
    }
    document.addEventListener("copy", onCopy)
    document.addEventListener("cut", onCut)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    return () => {
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("cut", onCut)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [selection])

  useEffect(() => {
    if (!handleMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-block-menu]")) setHandleMenu(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setHandleMenu(null)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [handleMenu])

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
    if (block.type !== "code") {
      if (raw.startsWith("/") && !block.text.startsWith("/")) setSlash({ blockId: block.id, active: 0 })
      else if (!raw.startsWith("/") && slash?.blockId === block.id) setSlash(null)
      else if (slash?.blockId === block.id) setSlash({ blockId: block.id, active: 0 })
    }
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

  const applySlash = (block: TextBlock, item: SlashItem) => {
    setSlash(null)
    const cleared = blocks.map((b) => (b.id === block.id ? { ...block, text: "" } : b))
    if ("type" in item) {
      onChange(cleared.map((b) => (b.id === block.id ? { ...block, type: item.type, text: "" } : b)))
      setPendingFocus({ id: block.id, caret: 0 })
    } else if (item.action === "drawing") {
      const drawing = newDrawingBlock()
      onChange(insertBlocks(cleared, [drawing], block.id))
      lastFocusedId.current = drawing.id
      setAutoEditId(drawing.id)
    } else {
      onChange(cleared)
      lastFocusedId.current = block.id
      fileInputRef.current?.click()
    }
  }

  const reorder = (from: number, to: number, side: "before" | "after") => {
    const next = moveBlock(blocks, from, to, side)
    if (next !== blocks) onChange(next)
  }

  const duplicateBlock = (index: number) => {
    const block = blocks[index]
    const copy = { ...block, id: newBlockId() } as Block
    onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: TextBlock, index: number) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const el = e.currentTarget
    const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0

    if (slash?.blockId === block.id) {
      const items = matchSlash(block.text.slice(1), allowAttachments)
      if (e.key === "Escape") {
        e.preventDefault()
        setSlash(null)
        return
      }
      if (items.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault()
        const step = e.key === "ArrowDown" ? 1 : -1
        setSlash({ blockId: block.id, active: (slash.active + step + items.length) % items.length })
        return
      }
      if (items.length > 0 && e.key === "Enter") {
        e.preventDefault()
        applySlash(block, items[Math.min(slash.active, items.length - 1)])
        return
      }
    }

    // Alt+Shift+↑/↓ moves the line itself.
    if (e.altKey && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault()
      const to = e.key === "ArrowUp" ? index - 1 : index + 1
      if (to < 0 || to >= blocks.length) return
      reorder(index, to, e.key === "ArrowUp" ? "before" : "after")
      setPendingFocus({ id: block.id, caret: el.selectionStart })
      return
    }

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
        onMouseDown={(e) => {
          if (e.button !== 0) return
          setSelection(null)
          dragFrom.current = blockIndexAt(e.target)
        }}
        onMouseMove={(e) => {
          if (e.buttons !== 1 || dragFrom.current === null) return
          const index = blockIndexAt(e.target)
          if (index === null) return
          if (!selection && index === dragFrom.current) return
          if (!selection) {
            ;(document.activeElement as HTMLElement | null)?.blur()
            window.getSelection()?.removeAllRanges()
          }
          e.preventDefault()
          if (!selection || selection.focus !== index) setSelection({ anchor: dragFrom.current, focus: index })
        }}
        className={`relative flex flex-col gap-1 rounded-lg transition-colors ${selection ? "select-none" : ""} ${
          dragging ? "bg-indigo-50/60 ring-2 ring-indigo-300 ring-offset-4 ring-offset-background" : ""
        }`}
        aria-label="페이지 본문"
      >
        {blocks.map((block, index) => {
          const wrap = (content: React.ReactNode) => (
            <div
              key={block.id}
              data-block-index={index}
              className={`group/block relative ${isSelected(index) ? "rounded-md bg-indigo-100/70 ring-1 ring-indigo-200" : ""} ${
                moving === index ? "opacity-40" : ""
              }`}
              onDragOver={(e) => {
                if (moving === null || !e.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                const rect = e.currentTarget.getBoundingClientRect()
                const side = e.clientY < rect.top + rect.height / 2 ? "before" : "after"
                if (dropAt?.index !== index || dropAt.side !== side) setDropAt({ index, side })
              }}
              onDrop={(e) => {
                if (moving === null || !e.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) return
                e.preventDefault()
                e.stopPropagation()
                if (dropAt) reorder(moving, dropAt.index, dropAt.side)
                setMoving(null)
                setDropAt(null)
              }}
            >
              {dropAt?.index === index && moving !== null && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-indigo-500 ${
                    dropAt.side === "before" ? "-top-[3px]" : "-bottom-[3px]"
                  }`}
                />
              )}
              <BlockHandle
                top={isTextBlock(block) ? handleTop[block.type] : "top-1"}
                index={index}
                count={blocks.length}
                open={handleMenu === block.id}
                onToggle={() => setHandleMenu((v) => (v === block.id ? null : block.id))}
                onDragStart={(e) => {
                  setHandleMenu(null)
                  setSelection(null)
                  e.dataTransfer.setData(BLOCK_DRAG_TYPE, String(index))
                  e.dataTransfer.effectAllowed = "move"
                  const row = e.currentTarget.closest("[data-block-index]")
                  if (row) e.dataTransfer.setDragImage(row, 0, 12)
                  setMoving(index)
                }}
                onDragEnd={() => {
                  setMoving(null)
                  setDropAt(null)
                }}
                onMove={(step) => {
                  setHandleMenu(null)
                  reorder(index, index + step, step === -1 ? "before" : "after")
                }}
                onDuplicate={() => {
                  setHandleMenu(null)
                  duplicateBlock(index)
                }}
                onDelete={() => {
                  setHandleMenu(null)
                  removeBlock(block.id)
                }}
              />
              {content}
            </div>
          )

          if (isDrawingBlock(block)) {
            return wrap(
              <DrawingBlockView
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
              />,
            )
          }
          if (!isTextBlock(block)) {
            return wrap(
              <AttachmentBlockView
                block={block}
                onRemove={() => removeBlock(block.id)}
                onChange={(next) => {
                  const current = latest.current
                  current.onChange(current.blocks.map((b) => (b.id === next.id ? next : b)))
                }}
              />,
            )
          }
          const hint = hintFor(index)
          const slashOpen = slash?.blockId === block.id && block.text.startsWith("/")
          const slashMatches = slashOpen ? matchSlash(block.text.slice(1), allowAttachments) : []
          return wrap(
            <>
              <div className="flex items-start gap-2">
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
                  aria-expanded={slashMatches.length > 0 ? true : undefined}
                  aria-controls={slashMatches.length > 0 ? `slash-${block.id}` : undefined}
                  value={block.text}
                  rows={1}
                  spellCheck={false}
                  onFocus={() => {
                    lastFocusedId.current = block.id
                  }}
                  onBlur={() => {
                    if (slash?.blockId === block.id) setSlash(null)
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
                    hint ??
                    (isSoleEmptyBlock
                      ? "자유롭게 학습 내용을 작성해보세요. / 를 누르면 제목, 목록, 그림 같은 메뉴가 나와요"
                      : block.type === "p"
                        ? undefined
                        : placeholders[block.type])
                  }
                  className={`w-full resize-none bg-transparent text-foreground outline-none [field-sizing:content] ${
                    hint || isSoleEmptyBlock
                      ? "placeholder:text-muted-foreground/60"
                      : "placeholder:text-transparent focus:placeholder:text-muted-foreground/50"
                  } ${blockStyles[block.type]}`}
                />
              </div>
              {slashMatches.length > 0 && slash && (
                <ul
                  id={`slash-${block.id}`}
                  role="listbox"
                  aria-label="블록 메뉴"
                  className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
                >
                  {slashMatches.map((item, i) => {
                    const Icon = item.icon
                    const active = i === Math.min(slash.active, slashMatches.length - 1)
                    return (
                      <li
                        key={item.label}
                        role="option"
                        aria-selected={active}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          applySlash(block, item)
                        }}
                        onMouseEnter={() => setSlash({ blockId: block.id, active: i })}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                          active ? "bg-indigo-50 text-indigo-700" : "text-foreground"
                        }`}
                      >
                        <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        {item.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>,
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

// Grip on the left of each block: drag to reorder, or click for move/duplicate/delete (works on touch too).
function BlockHandle({
  top,
  index,
  count,
  open,
  onToggle,
  onDragStart,
  onDragEnd,
  onMove,
  onDuplicate,
  onDelete,
}: {
  top: string
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onMove: (step: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40"
  return (
    <div data-block-menu className={`absolute -left-5 z-20 ${top}`}>
      <button
        type="button"
        draggable
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onToggle}
        aria-label="블록 옮기기 또는 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        title="끌어서 옮기기 · 눌러서 메뉴"
        className={`flex h-6 w-4 cursor-grab items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground active:cursor-grabbing focus-visible:opacity-100 ${
          open ? "opacity-100" : "opacity-0 group-hover/block:opacity-100 [@media(hover:none)]:opacity-30"
        }`}
      >
        <GripVertical className="size-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-7 w-40 rounded-xl border border-border bg-card p-1 shadow-lg">
          <button role="menuitem" type="button" disabled={index === 0} onClick={() => onMove(-1)} className={`${item} hover:bg-accent`}>
            <ArrowUp className="size-4 text-muted-foreground" />
            위로 옮기기
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className={`${item} hover:bg-accent`}
          >
            <ArrowDown className="size-4 text-muted-foreground" />
            아래로 옮기기
          </button>
          <button role="menuitem" type="button" onClick={onDuplicate} className={`${item} hover:bg-accent`}>
            <Copy className="size-4 text-muted-foreground" />
            복제
          </button>
          <div role="separator" className="my-1 border-t border-border" />
          <button role="menuitem" type="button" onClick={onDelete} className={`${item} text-destructive hover:bg-destructive/10`}>
            <Trash2 className="size-4" />
            삭제
          </button>
        </div>
      )}
    </div>
  )
}
