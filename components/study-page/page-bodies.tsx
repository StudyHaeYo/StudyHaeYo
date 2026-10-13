"use client"

import { useState, type KeyboardEvent, type Ref } from "react"
import { NotebookPen, Plus, X } from "lucide-react"
import { newBlockId, newItemId, noteOf, type Block, type StudyNoteContent } from "@/lib/study-pages"
import { BlockEditor, type AttachmentHandle } from "@/components/study-page/block-editor"

export interface PageBodyProps {
  blocks: Block[]
  note?: StudyNoteContent
  onChangeBlocks: (blocks: Block[]) => void
  onChangeNote: (note: StudyNoteContent) => void
  // The page header's "파일 첨부" opens this body's file picker; attachments always go into the free-text editor.
  attachRef?: Ref<AttachmentHandle>
}

const isComposing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229

export function StudyNoteBody({ blocks, note: stored, onChangeNote, attachRef }: PageBodyProps) {
  const note = noteOf({ note: stored, blocks })
  const learned = note.learned.length > 0 ? note.learned : [{ id: newBlockId(), type: "p" as const, text: "" }]

  return (
    <section aria-labelledby="study-note-body-heading" className="rounded-xl border border-indigo-100 bg-indigo-50/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-indigo-100 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700">
          <NotebookPen className="size-4" aria-hidden="true" />
          <span id="study-note-body-heading">학습 노트</span>
        </span>
        <span className="text-xs text-muted-foreground">오늘 배운 내용 · 핵심 개념 · 헷갈린 점</span>
      </div>

      <div className="flex flex-col gap-8 px-5 py-5">
        <NoteSection title="오늘 배운 내용">
          <BlockEditor
            blocks={learned}
            onChange={(next) => onChangeNote({ ...note, learned: next })}
            sectionHints={{}}
            allowAttachments
            attachRef={attachRef}
          />
        </NoteSection>

        <NoteSection title="핵심 개념" count={note.concepts.length}>
          <ItemList
            label="핵심 개념"
            items={note.concepts}
            placeholder="용어: 설명 형태로 적으면 복습 카드에서 앞/뒤로 나뉘어요"
            addLabel="개념 추가"
            onChange={(concepts) => onChangeNote({ ...note, concepts })}
            create={(text) => ({ id: newItemId("c"), text })}
          />
        </NoteSection>

        <NoteSection
          title="헷갈린 점"
          count={note.confusions.length}
          aside={
            note.confusions.length > 0
              ? `미해결 ${note.confusions.filter((c) => !c.resolved).length}개`
              : undefined
          }
        >
          <ItemList
            label="헷갈린 점"
            items={note.confusions}
            placeholder="아직 확실하지 않은 부분이나 다시 확인할 질문"
            addLabel="헷갈린 점 추가"
            onChange={(confusions) => onChangeNote({ ...note, confusions })}
            create={(text) => ({ id: newItemId("q"), text, resolved: false })}
            renderLead={(item, update) => (
              <input
                type="checkbox"
                checked={item.resolved}
                onChange={(e) => update({ ...item, resolved: e.target.checked })}
                aria-label={`해결됨: ${item.text || "빈 항목"}`}
                title="해결됨"
                className="mt-1 size-4 shrink-0 cursor-pointer accent-indigo-600"
              />
            )}
            itemTextClass={(item) => (item.resolved ? "text-muted-foreground line-through" : "text-foreground")}
          />
        </NoteSection>
      </div>
    </section>
  )
}

function NoteSection({
  title,
  count,
  aside,
  children,
}: {
  title: string
  count?: number
  aside?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">{count}</span>
          )}
        </h3>
        {aside && <span className="text-xs font-medium text-amber-700">{aside}</span>}
      </div>
      {children}
    </div>
  )
}

interface ItemListProps<T extends { id: string; text: string }> {
  label: string
  items: T[]
  placeholder: string
  addLabel: string
  onChange: (items: T[]) => void
  create: (text: string) => T
  renderLead?: (item: T, update: (item: T) => void) => React.ReactNode
  itemTextClass?: (item: T) => string
}

function ItemList<T extends { id: string; text: string }>({
  label,
  items,
  placeholder,
  addLabel,
  onChange,
  create,
  renderLead,
  itemTextClass,
}: ItemListProps<T>) {
  const [focusId, setFocusId] = useState<string | null>(null)

  const update = (item: T) => onChange(items.map((i) => (i.id === item.id ? item : i)))
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))
  const insertAfter = (index: number) => {
    const item = create("")
    onChange([...items.slice(0, index + 1), item, ...items.slice(index + 1)])
    setFocusId(item.id)
  }

  return (
    <div className="flex flex-col gap-1">
      {items.length > 0 && (
        <ul aria-label={label} className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-background focus-within:bg-background"
            >
              {renderLead ? (
                renderLead(item, update)
              ) : (
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
              )}
              <textarea
                value={item.text}
                rows={1}
                autoFocus={item.id === focusId}
                onChange={(e) => update({ ...item, text: e.target.value })}
                onKeyDown={(e) => {
                  if (isComposing(e)) return
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    insertAfter(index)
                  } else if (e.key === "Backspace" && item.text === "") {
                    e.preventDefault()
                    remove(item.id)
                    setFocusId(items[index - 1]?.id ?? null)
                  }
                }}
                aria-label={`${label} ${index + 1}`}
                placeholder={placeholder}
                className={`field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 ${itemTextClass?.(item) ?? "text-foreground"}`}
              />
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`${label} ${index + 1} 삭제`}
                className="mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => insertAfter(items.length - 1)}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-indigo-700"
      >
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}

export function FreeBody({ blocks, onChangeBlocks, attachRef }: PageBodyProps) {
  return (
    <div className="min-h-64">
      <BlockEditor blocks={blocks} onChange={onChangeBlocks} allowAttachments attachRef={attachRef} />
    </div>
  )
}
