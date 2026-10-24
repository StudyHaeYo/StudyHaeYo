"use client"

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { Minus, Plus } from "lucide-react"
import type { TableBlock } from "@/lib/study-pages"

// 표 block: a grid of plain-text cells, first row as the header. Tab / Shift+Tab move between cells
// (Tab in the last cell adds a row), Enter goes down a row. Rows and columns are added or removed with the
// buttons on the right and bottom edges.
export function TableBlockView({ block, onChange }: { block: TableBlock; onChange: (next: TableBlock) => void }) {
  const gridRef = useRef<HTMLTableElement>(null)
  const { rows } = block
  const cols = rows[0]?.length ?? 0

  // A cell in a row that doesn't exist yet (Tab/Enter past the last row) takes focus right after that row renders.
  const [focusAfterRender, setFocusAfterRender] = useState<[number, number] | null>(null)
  useLayoutEffect(() => {
    if (!focusAfterRender) return
    const [r, c] = focusAfterRender
    const cell = gridRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${r}-${c}"]`)
    if (!cell) return
    cell.focus()
    setFocusAfterRender(null)
  }, [focusAfterRender, rows])

  const focusCell = (r: number, c: number) => {
    const cell = gridRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${r}-${c}"]`)
    if (cell) cell.focus()
    else setFocusAfterRender([r, c])
  }

  const setCell = (r: number, c: number, value: string) =>
    onChange({ ...block, rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)) })

  const addRow = (at = rows.length) => {
    onChange({ ...block, rows: [...rows.slice(0, at), Array(cols).fill(""), ...rows.slice(at)] })
    return at
  }
  const addColumn = () => onChange({ ...block, rows: rows.map((row) => [...row, ""]) })
  const removeRow = () => rows.length > 2 && onChange({ ...block, rows: rows.slice(0, -1) })
  const removeColumn = () => cols > 1 && onChange({ ...block, rows: rows.map((row) => row.slice(0, -1)) })

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, r: number, c: number) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === "Tab") {
      e.preventDefault()
      e.stopPropagation()
      const index = r * cols + c + (e.shiftKey ? -1 : 1)
      if (index < 0) return
      if (index >= rows.length * cols) {
        addRow()
        focusCell(rows.length, 0)
        return
      }
      focusCell(Math.floor(index / cols), index % cols)
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      if (r === rows.length - 1) addRow()
      focusCell(r + 1, c)
    }
  }

  return (
    <div className="group/table relative my-1 pb-6 pr-7">
      <div className="overflow-x-auto">
        <table ref={gridRef} className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 ? "bg-muted/60" : ""}>
                {row.map((cell, c) => (
                  <td key={c} className="min-w-24 border border-border p-0 align-top">
                    <textarea
                      data-cell={`${r}-${c}`}
                      value={cell}
                      rows={1}
                      spellCheck={false}
                      aria-label={`${r === 0 ? "머리글" : `${r}행`} ${c + 1}열`}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onKeyDown={(e) => onKeyDown(e, r, c)}
                      placeholder={r === 0 ? "제목" : ""}
                      className={`block w-full resize-none bg-transparent px-2.5 py-1.5 leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/40 focus:bg-indigo-50/40 ${
                        r === 0 ? "font-semibold" : ""
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="absolute right-0 top-0 flex flex-col gap-0.5 opacity-0 transition-opacity group-focus-within/table:opacity-100 group-hover/table:opacity-100">
        <EdgeButton label="열 추가" onClick={addColumn}>
          <Plus className="size-3.5" />
        </EdgeButton>
        <EdgeButton label="마지막 열 삭제" onClick={removeColumn} disabled={cols <= 1}>
          <Minus className="size-3.5" />
        </EdgeButton>
      </div>
      <div className="absolute bottom-0 left-0 flex gap-0.5 opacity-0 transition-opacity group-focus-within/table:opacity-100 group-hover/table:opacity-100">
        <EdgeButton label="행 추가" onClick={() => addRow()}>
          <Plus className="size-3.5" />
        </EdgeButton>
        <EdgeButton label="마지막 행 삭제" onClick={removeRow} disabled={rows.length <= 2}>
          <Minus className="size-3.5" />
        </EdgeButton>
      </div>
    </div>
  )
}

function EdgeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  )
}
