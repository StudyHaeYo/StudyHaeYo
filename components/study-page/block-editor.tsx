"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { newBlockId, type Block, type BlockType } from "@/lib/study-pages"

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

interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  // Heading text → guiding question shown under that heading while its first paragraph is empty.
  sectionHints?: Record<string, string>
}

export function BlockEditor({ blocks, onChange, sectionHints }: BlockEditorProps) {
  const hintFor = (index: number) => {
    const block = blocks[index]
    const prev = blocks[index - 1]
    if (!sectionHints || block.type !== "p" || block.text !== "" || !prev || prev.type === "p") return undefined
    return sectionHints[prev.text.trim()]
  }
  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const [pendingFocus, setPendingFocus] = useState<{ id: string; caret: number } | null>(null)
  const isSoleEmptyBlock = blocks.length === 1 && blocks[0].text === ""

  useEffect(() => {
    if (!pendingFocus) return
    const el = refs.current.get(pendingFocus.id)
    if (el) {
      el.focus()
      el.setSelectionRange(pendingFocus.caret, pendingFocus.caret)
    }
    setPendingFocus(null)
  }, [pendingFocus])

  const updateText = (block: Block, raw: string) => {
    let type = block.type
    let text = raw
    if (block.type === "p") {
      const match = shortcuts.find((s) => raw.startsWith(s.prefix))
      if (match) {
        type = match.type
        text = raw.slice(match.prefix.length)
      }
    }
    onChange(blocks.map((b) => (b.id === block.id ? { ...b, type, text } : b)))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const el = e.currentTarget
    const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0

    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault()
      if (block.type === "li" && block.text === "") {
        onChange(blocks.map((b) => (b.id === block.id ? { ...b, type: "p" } : b)))
        return
      }
      const before = block.text.slice(0, el.selectionStart)
      const after = block.text.slice(el.selectionEnd)
      const next: Block = { id: newBlockId(), type: block.type === "li" ? "li" : "p", text: after }
      onChange([
        ...blocks.slice(0, index),
        { ...block, text: before },
        next,
        ...blocks.slice(index + 1),
      ])
      setPendingFocus({ id: next.id, caret: 0 })
      return
    }

    if (e.key === "Backspace" && caretAtStart) {
      if (block.type !== "p") {
        e.preventDefault()
        onChange(blocks.map((b) => (b.id === block.id ? { ...b, type: "p" } : b)))
        return
      }
      if (index > 0) {
        e.preventDefault()
        const prev = blocks[index - 1]
        onChange([
          ...blocks.slice(0, index - 1),
          { ...prev, text: prev.text + block.text },
          ...blocks.slice(index + 1),
        ])
        setPendingFocus({ id: prev.id, caret: prev.text.length })
      }
      return
    }

    if (e.key === "ArrowUp" && caretAtStart && index > 0) {
      e.preventDefault()
      setPendingFocus({ id: blocks[index - 1].id, caret: blocks[index - 1].text.length })
    }
    if (e.key === "ArrowDown" && el.selectionStart === block.text.length && index < blocks.length - 1) {
      e.preventDefault()
      setPendingFocus({ id: blocks[index + 1].id, caret: 0 })
    }
  }

  return (
    <div className="flex flex-col gap-1" aria-label="페이지 본문">
      {blocks.map((block, index) => {
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
            onChange={(e) => updateText(block, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block, index)}
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
    </div>
  )
}
