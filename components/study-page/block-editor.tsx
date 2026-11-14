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
  Check,
  ChevronRight,
  CircleHelp,
  Code,
  Copy,
  FileSymlink,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  KeyRound,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  ListCollapse,
  Minus,
  Paperclip,
  PenLine,
  Plus,
  Pilcrow,
  Quote,
  Sigma,
  Table,
  Trash2,
  MessageSquareText,
} from "lucide-react"
import { Cover, CoveredText, ReviewMarks, type ReviewView } from "@/components/study-page/review-marks"
import { MyAnswer, ProblemFoldedLine, ProblemNumber, WrongReasons } from "@/components/study-page/problem-paper"
import { CueLine, CueSlot, cueRow } from "@/components/study-page/cue-slot"
import {
  isDividerBlock,
  isDrawingBlock,
  isMathBlock,
  isPageLinkBlock,
  isTableBlock,
  isTextBlock,
  newBlockId,
  newTableBlock,
  type Block,
  type BlockType,
  type TextBlock,
} from "@/lib/study-pages"
import { usePagesForLinks } from "@/components/study-page/pages-context"
import { PageLinkCard, PageLinkPicker } from "@/components/study-page/page-link"
import { createAttachmentBlocks, type AttachmentStored } from "@/lib/attachments"
import { newDrawingBlock } from "@/lib/drawing"
import { AttachmentBlockView } from "@/components/study-page/attachment-block"
import { DrawingBlockView } from "@/components/study-page/drawing-block"
import { TableBlockView } from "@/components/study-page/table-block"
import { MathBlockView } from "@/components/study-page/math-block"

// Typed at the start of an empty-ish paragraph (Notion's markdown shortcuts). "---" makes a divider (handled apart).
const shortcuts: { prefix: string; type: BlockType; checked?: boolean }[] = [
  { prefix: "### ", type: "h3" },
  { prefix: "## ", type: "h2" },
  { prefix: "# ", type: "h1" },
  { prefix: "[] ", type: "todo" },
  { prefix: "[ ] ", type: "todo" },
  { prefix: "[x] ", type: "todo", checked: true },
  { prefix: "- ", type: "li" },
  { prefix: "* ", type: "li" },
  { prefix: "1. ", type: "ol" },
  { prefix: "> ", type: "toggle" },
  { prefix: '" ', type: "quote" },
  { prefix: "```", type: "code" },
]

// Types that continue on Enter (a new line of the same list); an empty one turns back into a paragraph.
const LIST_TYPES = new Set<BlockType>(["li", "ol", "todo", "concept", "confusion"])
const HEADING_TYPES = new Set<BlockType>(["h1", "h2", "h3"])
// 복습 marks beside a heading: down by the heading's top padding so they sit on its text line.
const markOffset: Partial<Record<BlockType, string>> = { h1: "mt-[22px]", h2: "mt-4", h3: "mt-2" }

const blockStyles: Record<BlockType, string> = {
  h1: "text-2xl font-bold tracking-tight pt-4",
  h2: "text-xl font-semibold tracking-tight pt-3",
  h3: "text-lg font-semibold pt-1",
  p: "text-base leading-relaxed",
  li: "text-base leading-relaxed",
  ol: "text-base leading-relaxed",
  todo: "text-base leading-relaxed",
  toggle: "text-base font-medium leading-relaxed",
  quote: "text-base leading-relaxed",
  callout: "text-base leading-relaxed",
  code: "rounded-lg bg-muted px-4 py-3 font-mono text-sm leading-relaxed",
  concept: "text-base leading-relaxed",
  confusion: "text-base leading-relaxed",
}

const placeholders: Record<BlockType, string> = {
  h1: "제목 1",
  h2: "제목 2",
  h3: "제목 3",
  p: "내용을 입력하세요. # 제목, - 목록, ``` 코드",
  li: "목록",
  ol: "목록",
  todo: "할 일",
  toggle: "토글 제목 (예: 문제)",
  quote: "인용",
  callout: "강조할 내용",
  code: "코드를 입력하세요",
  concept: "용어: 설명",
  confusion: "헷갈리는 것이나 다시 확인할 질문",
}

// Lines the grip up with the first text line (headings have top padding).
const handleTop: Record<BlockType, string> = {
  h1: "top-[19px]",
  h2: "top-[14px]",
  h3: "top-[6px]",
  p: "top-0.5",
  li: "top-0.5",
  ol: "top-0.5",
  todo: "top-0.5",
  toggle: "top-0.5",
  quote: "top-0.5",
  callout: "top-3",
  code: "top-2.5",
  concept: "top-0.5",
  confusion: "top-0.5",
}

const emptyParagraph = (): TextBlock => ({ id: newBlockId(), type: "p", text: "" })

// Changes a text block's type, keeping only the fields that type uses.
function withType(block: TextBlock, type: BlockType, checked = false): TextBlock {
  const base: TextBlock = { id: block.id, type, text: block.text }
  // A cue belongs to the line, whatever the line turns into (코넬 노트, D-35).
  if (block.cue) base.cue = block.cue
  if (type === "todo" || type === "confusion") base.checked = block.checked ?? checked
  if (type === "toggle") {
    base.body = block.body ?? ""
    base.open = block.open ?? true
    // A problem stays a problem with its marks when it was a toggle already (only the text type changes elsewhere).
    if (block.type === "toggle") {
      if (block.result) base.result = block.result
      if (block.triedOn) base.triedOn = block.triedOn
      if (block.myAnswer) base.myAnswer = block.myAnswer
      if (block.reasons?.length) base.reasons = block.reasons
    }
  }
  return base
}

const markdownPrefix: Record<BlockType, string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  li: "- ",
  ol: "1. ",
  todo: "- [ ] ",
  toggle: "▸ ",
  quote: "> ",
  callout: "> 💡 ",
  p: "",
  code: "",
  concept: "- ",
  confusion: "- ",
}

// "/" menu: typed at the start of a line, filtered by what follows the slash.
type SlashItem = { label: string; keywords: string; icon: typeof Pilcrow } & (
  | { type: BlockType }
  | { action: "file" | "drawing" | "divider" | "pagelink" | "table" | "math" }
)

const slashItems: SlashItem[] = [
  { label: "본문", keywords: "본문 텍스트 글 text paragraph", icon: Pilcrow, type: "p" },
  { label: "제목 1", keywords: "제목1 큰제목 heading h1", icon: Heading1, type: "h1" },
  { label: "제목 2", keywords: "제목2 중간제목 heading h2", icon: Heading2, type: "h2" },
  { label: "제목 3", keywords: "제목3 작은제목 heading h3", icon: Heading3, type: "h3" },
  { label: "목록", keywords: "목록 리스트 글머리 list bullet li", icon: List, type: "li" },
  { label: "번호 목록", keywords: "번호목록 순서 numbered ol 1.", icon: ListOrdered, type: "ol" },
  { label: "체크 목록", keywords: "체크목록 할일 투두 todo check", icon: ListChecks, type: "todo" },
  { label: "토글", keywords: "토글 접기 문제 정답 toggle", icon: ListCollapse, type: "toggle" },
  { label: "인용", keywords: "인용 quote", icon: Quote, type: "quote" },
  { label: "콜아웃", keywords: "콜아웃 강조 박스 중요 callout", icon: Lightbulb, type: "callout" },
  { label: "핵심 개념", keywords: "핵심개념 개념 용어 복습 카드 concept", icon: KeyRound, type: "concept" },
  { label: "헷갈린 점", keywords: "헷갈린점 헷갈림 질문 모름 confusion question", icon: CircleHelp, type: "confusion" },
  { label: "표", keywords: "표 테이블 table 비교", icon: Table, action: "table" },
  { label: "수식", keywords: "수식 수학 공식 latex math katex", icon: Sigma, action: "math" },
  { label: "구분선", keywords: "구분선 선 divider hr", icon: Minus, action: "divider" },
  { label: "페이지 링크", keywords: "페이지링크 링크 연결 link page", icon: FileSymlink, action: "pagelink" },
  { label: "코드", keywords: "코드 code", icon: Code, type: "code" },
  { label: "그림", keywords: "그림 필기 손글씨 드로잉 drawing draw pen", icon: PenLine, action: "drawing" },
  { label: "파일 첨부", keywords: "파일 첨부 이미지 사진 pdf file image attach", icon: Paperclip, action: "file" },
]

function matchSlash(query: string, allowAttachments: boolean) {
  const q = query.trim().toLowerCase().replace(/\s+/g, "")
  return slashItems.filter(
    (item) =>
      (allowAttachments || !("action" in item) || !["file", "drawing"].includes(item.action)) &&
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
  if (isTextBlock(block)) {
    if (block.type === "code") return "```\n" + block.text + "\n```"
    if (block.type === "todo") return (block.checked ? "- [x] " : "- [ ] ") + block.text
    if (block.type === "toggle") return markdownPrefix.toggle + block.text + (block.body ? "\n" + block.body : "")
    return markdownPrefix[block.type] + block.text
  }
  if (isDividerBlock(block)) return "---"
  if (isPageLinkBlock(block)) return "[페이지 링크]"
  if (isTableBlock(block))
    return block.rows.map((row, i) => `| ${row.join(" | ")} |` + (i === 0 ? `\n|${row.map(() => " --- |").join("")}` : "")).join("\n")
  if (isMathBlock(block)) return `$$\n${block.tex}\n$$`
  return isDrawingBlock(block) ? "[그림]" : `[첨부] ${block.name}`
}

// Number shown before an "ol" block: counts the run of consecutive ol blocks above it.
function listNumber(blocks: Block[], index: number) {
  let n = 1
  for (let i = index - 1; i >= 0; i--) {
    const b = blocks[i]
    if (!isTextBlock(b) || b.type !== "ol") break
    n += 1
  }
  return n
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
  // Only an empty paragraph gives way. An empty card, question or list line from a template stays put.
  const replaceTarget = target !== undefined && isTextBlock(target) && target.type === "p" && target.text === ""
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
  // A retried upload finished: give the block its Storage path. Returns false if the block is gone.
  // Retries can finish after this editor is gone, so this reads the saved page rather than `blocks`.
  onAttachmentStored?: AttachmentStored
  // 오답 노트 (D-27): each toggle is a problem; show 맞힘/틀림 marks and save the result on the block.
  problemMode?: { today: string | null }
  // 강의 노트 = 코넬 노트 (D-35): each text block can carry a cue in the left margin.
  cues?: boolean
  // 복습 (D-34): answers covered in place, opened and marked one by one.
  review?: ReviewView
}

export interface AttachmentHandle {
  openPicker: () => void
  insertDrawing: () => void
  // Attaches files at the top of the note (강의 노트's [강의 PDF 올리기]) and returns the new blocks.
  attachAtTop: (files: File[]) => Promise<Block[]>
}

export function BlockEditor({
  blocks,
  onChange,
  sectionHints,
  allowAttachments = false,
  attachRef,
  onAttachmentStored,
  problemMode,
  cues = false,
  review,
}: BlockEditorProps) {
  // 오답 노트: [문제 추가] sits under the last problem.
  const lastToggleIndex = problemMode ? blocks.findLastIndex((b) => isTextBlock(b) && b.type === "toggle") : -1
  // 오답 노트 (D-35): problems are numbered down the paper.
  const problemNumbers = new Map(
    problemMode ? blocks.filter((b) => isTextBlock(b) && b.type === "toggle").map((b, i) => [b.id, i + 1] as const) : [],
  )
  const hintFor = (index: number) => {
    const block = blocks[index]
    const prev = blocks[index - 1]
    if (!sectionHints || !isTextBlock(block) || !["p", "li", "ol", "todo"].includes(block.type) || block.text !== "") return undefined
    if (!prev || !isTextBlock(prev) || !["h1", "h2", "h3"].includes(prev.type)) return undefined
    return sectionHints[prev.text.trim()]
  }
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFocusedId = useRef<string | null>(null)
  // Attachment URLs resolve asynchronously; insert into the latest blocks, not the ones from the event.
  const latest = useRef({ blocks, onChange, onAttachmentStored })
  const [pendingFocus, setPendingFocus] = useState<{ id: string; caret: number } | null>(null)
  // A table just added from the "/" menu: its first cell takes focus once the table is on screen.
  const [focusTableId, setFocusTableId] = useState<string | null>(null)
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
  // 코넬 노트: the block whose cue is being written.
  const [editingCue, setEditingCue] = useState<string | null>(null)
  const setCue = (id: string, cue: string | undefined) =>
    latest.current.onChange(
      latest.current.blocks.map((b) => (b.id === id && isTextBlock(b) ? (cue?.trim() ? { ...b, cue } : { ...b, cue: undefined }) : b)),
    )
  // "/페이지 링크": the empty block that will become a page link while its picker is open.
  const [linkPicker, setLinkPicker] = useState<string | null>(null)
  const pages = usePagesForLinks()
  const selStart = selection ? Math.min(selection.anchor, selection.focus) : -1
  const selEnd = selection ? Math.max(selection.anchor, selection.focus) : -1
  const isSelected = (index: number) => index >= selStart && index <= selEnd
  const first = blocks[0]
  const isSoleEmptyBlock = blocks.length === 1 && isTextBlock(first) && first.text === ""

  useLayoutEffect(() => {
    latest.current = { blocks, onChange, onAttachmentStored }
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
      attachAtTop: async (files) => {
        if (files.length === 0) return []
        const created = await createAttachmentBlocks(files, (blockId, path) => latest.current.onAttachmentStored?.(blockId, path) ?? false)
        if (created.length === 0) return []
        const current = latest.current
        current.onChange([...created, ...current.blocks])
        return created
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
    if (!focusTableId) return
    const cell = containerRef.current?.querySelector<HTMLTextAreaElement>(`[data-block-id="${focusTableId}"] [data-cell="0-0"]`)
    if (!cell) return // not rendered yet: try again after the next render
    cell.focus()
    setFocusTableId(null)
  }, [focusTableId, blocks])

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
    const created = await createAttachmentBlocks(files, (blockId, path) => onAttachmentStored?.(blockId, path) ?? false)
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
    if (block.type === "p" && raw === "---") {
      const index = blocks.findIndex((b) => b.id === block.id)
      const after = emptyParagraph()
      onChange([...blocks.slice(0, index), { id: block.id, type: "divider" }, after, ...blocks.slice(index + 1)])
      setPendingFocus({ id: after.id, caret: 0 })
      return
    }
    let next: TextBlock = { ...block, text: raw }
    if (block.type === "p") {
      const match = shortcuts.find((s) => raw.startsWith(s.prefix))
      if (match) next = withType({ ...block, text: raw.slice(match.prefix.length) }, match.type, match.checked)
    }
    onChange(blocks.map((b) => (b.id === block.id ? next : b)))
  }

  const applySlash = (block: TextBlock, item: SlashItem) => {
    setSlash(null)
    const cleared = blocks.map((b) => (b.id === block.id ? { ...block, text: "" } : b))
    if ("type" in item) {
      onChange(cleared.map((b) => (b.id === block.id ? withType({ ...block, text: "" }, item.type) : b)))
      setPendingFocus({ id: block.id, caret: 0 })
    } else if (item.action === "divider") {
      onChange(insertBlocks(cleared, [{ id: newBlockId(), type: "divider" }], block.id))
    } else if (item.action === "table") {
      const table = newTableBlock()
      onChange(insertBlocks(cleared, [table], block.id))
      setFocusTableId(table.id)
    } else if (item.action === "math") {
      onChange(insertBlocks(cleared, [{ id: newBlockId(), type: "math", tex: "" }], block.id))
    } else if (item.action === "pagelink") {
      onChange(cleared)
      setLinkPicker(block.id)
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
      if (LIST_TYPES.has(block.type) && block.text === "") {
        onChange(blocks.map((b) => (b.id === block.id ? withType(block, "p") : b)))
        return
      }
      // A toggle's title: open it and continue in its body.
      if (block.type === "toggle") {
        onChange(blocks.map((b) => (b.id === block.id ? { ...block, open: true } : b)))
        setPendingFocus({ id: `${block.id}:body`, caret: block.body?.length ?? 0 })
        return
      }
      const before = block.text.slice(0, el.selectionStart)
      const after = block.text.slice(el.selectionEnd)
      const next = withType({ id: newBlockId(), type: "p", text: after }, LIST_TYPES.has(block.type) ? block.type : "p")
      onChange([...blocks.slice(0, index), { ...block, text: before }, next, ...blocks.slice(index + 1)])
      setPendingFocus({ id: next.id, caret: 0 })
      return
    }

    if (e.key === "Backspace" && caretAtStart) {
      if (block.type !== "p") {
        e.preventDefault()
        // A toggle's folded body becomes the paragraph below, so nothing is lost.
        const unfolded: Block[] = block.body ? [{ id: newBlockId(), type: "p", text: block.body }] : []
        onChange([...blocks.slice(0, index), withType(block, "p"), ...unfolded, ...blocks.slice(index + 1)])
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
          dragging ? "bg-action-50/60 ring-2 ring-action-300 ring-offset-4 ring-offset-background" : ""
        }`}
        aria-label="페이지 본문"
      >
        {/* 코넬 노트: the margin is drawn from the start — its name and a rule down the page — so an empty 강의 노트
            already reads as a Cornell sheet instead of a blank page (2026-11-13). Only where the margin has room. */}
        {cues && (
          <>
            <p aria-hidden="true" className="pointer-events-none absolute -top-7 right-[calc(100%+1.75rem)] z-[1] hidden w-40 text-right text-xs font-medium text-muted-foreground @min-[66.5rem]/page:block">
              질문
            </p>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -top-9 right-[calc(100%+1.25rem)] hidden w-[11rem] rounded-l-lg border-r border-border bg-muted/60 @min-[66.5rem]/page:block"
            />
          </>
        )}
        {blocks.map((block, index) => {
          // 복습: what is under a heading being recalled stays out of sight until that heading is opened.
          if (review?.covered.has(block.id)) return null
          const wrap = (content: React.ReactNode) => (
            <div
              key={block.id}
              // `#b-<id>` opens the note at this block (시험 정리's "시험 전에 다시 볼 것" links here).
              id={`b-${block.id}`}
              data-block-index={index}
              className={`group/block relative scroll-mt-28 ${cues ? cueRow : ""} ${
                // 채점된 시험지: a dashed rule between problems, like the rows of an exam paper.
                problemMode && block.type === "toggle" && problemNumbers.get(block.id) !== 1 ? "mt-3 border-t border-dashed border-border pt-4" : ""
              } ${isSelected(index) ? "rounded-md bg-action-100/70 ring-1 ring-action-200" : ""} ${
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
                  className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-action-500 ${
                    dropAt.side === "before" ? "-top-[3px]" : "-bottom-[3px]"
                  }`}
                />
              )}
              <BlockHandle
                top={isTextBlock(block) ? handleTop[block.type] : "top-1"}
                textLine={isTextBlock(block)}
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
                cueLabel={cues && isTextBlock(block) && !review ? (block.cue?.trim() ? "질문 고치기" : "질문 달기") : undefined}
                onCue={() => {
                  setHandleMenu(null)
                  setEditingCue(block.id)
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
          if (isDividerBlock(block)) {
            return wrap(<hr className="my-3 border-border" aria-label="구분선" />)
          }
          if (isPageLinkBlock(block)) {
            return wrap(<PageLinkCard pageId={block.pageId} pages={pages} />)
          }
          if (isTableBlock(block) || isMathBlock(block)) {
            const update = (next: Block) => {
              const current = latest.current
              current.onChange(current.blocks.map((b) => (b.id === next.id ? next : b)))
            }
            return wrap(
              <div data-block-id={block.id}>
                {isTableBlock(block) ? (
                  <TableBlockView block={block} onChange={update} />
                ) : (
                  <MathBlockView block={block} onChange={update} />
                )}
              </div>,
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
          // 코넬 노트's starting lines say what the margin is for (the first line) and what the 요약 is (D-35).
          const hint =
            hintFor(index) ??
            (cues && block.type === "p" && block.text === ""
              ? block.cue?.trim() === "요약"
                ? "이 강의를 두세 줄로 요약해요"
                : index === 0
                  ? "필기를 적어요 · 줄 왼쪽에 질문을 달면 복습할 때 그 줄만 가려져요"
                  : undefined
              : undefined)
          const reviewEntry = review?.items.get(block.id)
          const reviewItem = reviewEntry ? review : undefined
          const reviewOpened = !!reviewItem?.opened[block.id]
          const toggleOpen = reviewItem && block.type === "toggle" ? reviewOpened : block.open !== false
          // 오답 노트 problem: a number column and marks around the toggle, so its inner rows start further in.
          const isProblem = !!problemMode && block.type === "toggle"
          const inner = isProblem ? "ml-[4.5rem] w-[calc(100%-4.5rem)]" : "ml-7 w-[calc(100%-1.75rem)]"
          const solved = isProblem && block.result === "right"
          // A 핵심 개념 or a paragraph under review shows its cue and covers the rest (no editing while covered).
          const coveredText = reviewItem && (reviewEntry?.type === "concept" || reviewEntry?.type === "paragraph")
          const slashOpen = slash?.blockId === block.id && block.text.startsWith("/")
          const slashMatches = slashOpen ? matchSlash(block.text.slice(1), allowAttachments) : []
          const cueSlotAt = (at: BlockType | "cover") =>
            cues && (
              <>
                <CueSlot
                  cue={block.cue}
                  type={at}
                  editing={editingCue === block.id}
                  readOnly={!!review}
                  onEdit={() => setEditingCue(block.id)}
                  onChange={(cue) =>
                    latest.current.onChange(latest.current.blocks.map((b) => (b.id === block.id && isTextBlock(b) ? { ...b, cue } : b)))
                  }
                  onDone={() => {
                    setEditingCue(null)
                    const now = latest.current.blocks.find((b) => b.id === block.id)
                    if (now && isTextBlock(now) && now.cue !== undefined && !now.cue.trim()) setCue(block.id, undefined)
                  }}
                />
                {block.cue?.trim() && <CueLine />}
              </>
            )
          // 복습 of a 코넬 노트: the cue stays, the whole block under it is covered until opened (D-35).
          if (reviewItem && reviewEntry?.type === "cue" && !reviewOpened) {
            return wrap(
              <>
                {cueSlotAt("cover")}
                <Cover name={reviewEntry.label} onOpen={() => reviewItem.onOpen(block.id)} />
              </>,
            )
          }
          return wrap(
            <>
              {cueSlotAt(block.type)}
              <div
                className={`flex items-start gap-2  ${
                  block.type === "quote"
                    ? "border-l-[3px] border-foreground/70 pl-3"
                    : block.type === "callout"
                      ? "rounded-lg bg-muted/70 px-3 py-2.5"
                      : ""
                }`}
              >
                {block.type === "li" && (
                  <span aria-hidden="true" className="select-none pt-0.5 text-base leading-relaxed text-muted-foreground">
                    •
                  </span>
                )}
                {block.type === "ol" && (
                  <span aria-hidden="true" className="min-w-5 select-none pt-0.5 text-base leading-relaxed tabular-nums text-muted-foreground">
                    {listNumber(blocks, index)}.
                  </span>
                )}
                {block.type === "callout" && (
                  <span aria-hidden="true" className="select-none pt-0.5 text-base leading-relaxed">
                    💡
                  </span>
                )}
                {/* Plain lines like the rest of the note (D-34): a small mark, no card. */}
                {block.type === "concept" && (
                  <span title="핵심 개념 · 복습할 때 설명이 가려져요" className="mt-[5px] shrink-0 select-none text-action-500">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                )}
                {block.type === "confusion" && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={block.checked === true}
                    aria-label={block.checked ? "해결 취소" : "해결함"}
                    title={block.checked ? "해결함" : "헷갈린 점 · 해결하면 눌러요"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onChange(blocks.map((b) => (b.id === block.id ? { ...block, checked: !block.checked } : b)))}
                    className={`mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                      block.checked
                        ? "border-muted-foreground/40 bg-muted-foreground/40 text-white"
                        : "border-attention-500 text-attention-700 hover:bg-attention-50"
                    }`}
                  >
                    {block.checked ? <Check className="size-3" /> : <span className="text-[11px] font-bold leading-none">?</span>}
                  </button>
                )}
                {block.type === "todo" && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={block.checked === true}
                    aria-label={block.checked ? "완료 취소" : "완료"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onChange(blocks.map((b) => (b.id === block.id ? { ...block, checked: !block.checked } : b)))}
                    className={`mt-1 flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                      block.checked ? "border-foreground bg-foreground text-background" : "border-muted-foreground/50 hover:border-foreground"
                    }`}
                  >
                    {block.checked && <Check className="size-3" />}
                  </button>
                )}
                {isProblem && <ProblemNumber n={problemNumbers.get(block.id) ?? 0} result={block.result} marked={block.text.trim() !== ""} />}
                {block.type === "toggle" && (
                  <button
                    type="button"
                    aria-expanded={toggleOpen}
                    aria-label={toggleOpen ? "접기" : reviewItem ? "떠올려 본 뒤 펼치기" : "펼치기"}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      reviewItem
                        ? reviewItem.onOpen(block.id)
                        : onChange(blocks.map((b) => (b.id === block.id ? { ...block, open: block.open === false } : b)))
                    }
                    className="mt-1 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ChevronRight className={`size-4 transition-transform ${toggleOpen ? "rotate-90" : ""}`} />
                  </button>
                )}
                {coveredText ? (
                  <CoveredText
                    text={block.text}
                    cue={reviewEntry!.label}
                    opened={reviewOpened}
                    mark={reviewItem.marks[block.id]}
                    onOpen={() => reviewItem.onOpen(block.id)}
                    onMark={(j) => reviewItem.onMark(block.id, j)}
                    className={`text-foreground ${blockStyles[block.type]}`}
                  />
                ) : (
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
                    (isProblem
                      ? "틀린 문제를 적어요"
                      : isSoleEmptyBlock
                        ? "/ 를 누르면 제목, 목록, 토글 같은 메뉴가 나와요"
                        : block.type === "p"
                          ? undefined
                          : placeholders[block.type])
                  }
                  className={`w-full resize-none bg-transparent text-foreground outline-none [field-sizing:content] ${
                    hint || isSoleEmptyBlock || block.type === "concept" || block.type === "confusion" || (problemMode && block.type === "toggle")
                      ? "placeholder:text-muted-foreground/60"
                      : "placeholder:text-transparent focus:placeholder:text-muted-foreground/50"
                  } ${blockStyles[block.type]} ${(block.type === "todo" || block.type === "confusion") && block.checked ? "text-muted-foreground line-through" : ""} ${
                    isProblem ? (solved && !reviewItem ? "!text-muted-foreground" : "font-semibold") : ""
                  }`}
                />
                )}
                {reviewItem && reviewOpened && (HEADING_TYPES.has(block.type) || reviewEntry?.type === "toggle" || reviewEntry?.type === "cue") && (
                  <ReviewMarks
                    value={reviewItem.marks[block.id]}
                    onMark={(j) => reviewItem.onMark(block.id, j)}
                    className={markOffset[block.type] ?? "mt-0.5"}
                  />
                )}
                {problemMode && block.type === "toggle" && block.text.trim() !== "" && (!reviewItem || toggleOpen) && (
                  <span role="group" aria-label="이 문제 결과" className="mt-0.5 flex shrink-0 gap-0.5">
                    {(["right", "wrong"] as const).map((r) => {
                      // In review the marks show this try only; outside review, the last saved result (none = wrong, D-27).
                      const pressed = reviewItem ? reviewItem.marks[block.id] === r : (block.result ?? "wrong") === r
                      return (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={pressed}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            onChange(
                              blocks.map((b) =>
                                b.id === block.id
                                  ? { ...block, result: r, ...(problemMode.today ? { triedOn: problemMode.today } : {}) }
                                  : b,
                              ),
                            )
                            reviewItem?.onMark(block.id, r)
                          }}
                          // Small words, no fill (D-35): the number's mark already says it louder.
                          className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                            pressed
                              ? r === "right"
                                ? "font-semibold text-success-700"
                                : "font-semibold text-danger-700"
                              : "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {r === "right" ? "맞힘" : "틀림"}
                        </button>
                      )
                    })}
                  </span>
                )}
              </div>
              {/* 복습: under a heading, the gray line stands in for its section; under a toggle, for what is inside. */}
              {reviewItem && !reviewOpened && (HEADING_TYPES.has(block.type) || block.type === "toggle") && (
                <div className={block.type === "toggle" ? `${inner} mt-1 flex flex-col gap-1.5` : "mt-1.5"}>
                  {/* 다시 풀기: my answer stays in sight, only the answer and 풀이 are covered (D-35). */}
                  {isProblem && <MyAnswer value={block.myAnswer} problem={block.text} onChange={() => {}} readOnly />}
                  <Cover
                    label={isProblem ? "정답 · 풀이 · 떠올려 보고 눌러서 보기" : block.type === "toggle" ? "눌러서 펼치기" : "눌러서 보기"}
                    name={block.text.trim()}
                    onOpen={() => reviewItem.onOpen(block.id)}
                  />
                </div>
              )}
              {isProblem && !toggleOpen && !reviewItem && block.text.trim() !== "" && (
                <div className={inner}>
                  <ProblemFoldedLine block={block} />
                </div>
              )}
              {isProblem && toggleOpen && (
                <div className={`${inner} mt-1`}>
                  <MyAnswer
                    value={block.myAnswer}
                    problem={block.text}
                    onChange={(myAnswer) =>
                      onChange(latest.current.blocks.map((b) => (b.id === block.id && isTextBlock(b) ? { ...b, myAnswer } : b)))
                    }
                  />
                </div>
              )}
              {block.type === "toggle" && toggleOpen && (
                <div className={isProblem ? `${inner} flex items-baseline gap-2` : "contents"}>
                {isProblem && <span className="w-7 shrink-0 text-xs text-muted-foreground">정답</span>}
                <textarea
                  ref={(el) => {
                    if (el) refs.current.set(`${block.id}:body`, el)
                    else refs.current.delete(`${block.id}:body`)
                  }}
                  value={block.body ?? ""}
                  rows={1}
                  spellCheck={false}
                  aria-label={`${block.text || "토글"} 내용`}
                  placeholder={isProblem ? "정답과 풀이, 왜 틀렸는지…" : "펼치면 보이는 내용 (예: 정답과 풀이)"}
                  onChange={(e) => onChange(blocks.map((b) => (b.id === block.id ? { ...block, body: e.target.value } : b)))}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return
                    const el = e.currentTarget
                    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && !block.body) {
                      e.preventDefault()
                      setPendingFocus({ id: block.id, caret: block.text.length })
                    }
                  }}
                  className={`${isProblem ? "min-w-0 flex-1" : inner} resize-none bg-transparent text-base leading-relaxed text-foreground outline-none [field-sizing:content] ${
                    problemMode ? "placeholder:text-muted-foreground/60" : "placeholder:text-transparent focus:placeholder:text-muted-foreground/50"
                  }`}
                />
                </div>
              )}
              {isProblem && toggleOpen && !solved && block.text.trim() !== "" && (
                <div className={`${inner} mt-1.5`}>
                  <WrongReasons
                    value={block.reasons}
                    onChange={(reasons) =>
                      onChange(
                        latest.current.blocks.map((b) =>
                          b.id === block.id && isTextBlock(b) ? (reasons.length > 0 ? { ...b, reasons } : { ...b, reasons: undefined }) : b,
                        ),
                      )
                    }
                  />
                </div>
              )}
              {linkPicker === block.id && (
                <PageLinkPicker
                  pages={pages}
                  onPick={(pageId) => {
                    setLinkPicker(null)
                    onChange(insertBlocks(latest.current.blocks, [{ id: newBlockId(), type: "pagelink", pageId }], block.id))
                  }}
                  onClose={() => {
                    setLinkPicker(null)
                    setPendingFocus({ id: block.id, caret: 0 })
                  }}
                />
              )}
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
                          active ? "bg-action-50 text-action-700" : "text-foreground"
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
              {problemMode && index === lastToggleIndex && (
                <button
                  type="button"
                  onClick={() => {
                    const added: TextBlock = { id: newBlockId(), type: "toggle", text: "", body: "", open: true }
                    onChange(insertBlocks(blocks, [added], block.id))
                    setPendingFocus({ id: added.id, caret: 0 })
                  }}
                  className="ml-[4.5rem] mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  문제 추가
                </button>
              )}
            </>,
          )
        })}
        {dragging && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-medium text-action-700">
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
  textLine,
  cueLabel,
  onCue,
}: {
  top: string
  // Text lines can take focus; a picture, file or drawing can't on every phone, so it keeps a faint grip.
  textLine: boolean
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onMove: (step: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  // 코넬 노트: "질문 달기" (the cue; the screen calls it 질문) for screens without the margin (and for keyboards).
  cueLabel?: string
  onCue?: () => void
}) {
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40"
  return (
    <div data-block-menu className={`absolute -left-5 z-20 ${top}`}>
      {/* On a phone every line used to carry a faint grip, and the 16px grip was hard to hit. Touch screens show it
          only on the line being edited, with a hit area that reaches past the grip. */}
      <button
        type="button"
        draggable
        onMouseDown={(e) => e.stopPropagation()}
        // A tap keeps the line focused, so the grip shown for that line stays tappable until the click lands.
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") e.preventDefault()
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onToggle}
        aria-label="블록 옮기기 또는 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        title="끌어서 옮기기 · 눌러서 메뉴"
        className={`relative flex h-6 w-4 cursor-grab items-center justify-center rounded text-muted-foreground transition-opacity after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-[''] hover:bg-accent hover:text-foreground active:cursor-grabbing focus-visible:opacity-100 ${
          open
            ? "opacity-100"
            : textLine
              ? "opacity-0 group-hover/block:opacity-100 [@media(hover:none)]:pointer-events-none [@media(hover:none)]:group-focus-within/block:pointer-events-auto [@media(hover:none)]:group-focus-within/block:opacity-100"
              : "opacity-0 group-hover/block:opacity-100 [@media(hover:none)]:opacity-30"
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
          {cueLabel && onCue && (
            <button role="menuitem" type="button" onClick={onCue} className={`${item} hover:bg-accent`}>
              <MessageSquareText className="size-4 text-muted-foreground" />
              {cueLabel}
            </button>
          )}
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
