"use client"

import { useMemo, useState } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import type { MathBlock } from "@/lib/study-pages"

// 수식 block: LaTeX typed in a box, shown rendered with KaTeX. Click the formula to edit; Esc or leaving the box
// shows it rendered again. A new, empty block opens in edit mode.
export function MathBlockView({ block, onChange }: { block: MathBlock; onChange: (next: MathBlock) => void }) {
  const [editing, setEditing] = useState(block.tex === "")
  const rendered = useMemo(() => {
    if (!block.tex.trim()) return null
    try {
      // trust: false (default) keeps \href, \includegraphics and the like out; throwOnError: false shows errors inline.
      return { html: katex.renderToString(block.tex, { displayMode: true, throwOnError: false, strict: "ignore" }), error: false }
    } catch {
      return { html: "", error: true }
    }
  }, [block.tex])

  return (
    <div className="my-1 rounded-lg">
      {editing && (
        <textarea
          autoFocus
          value={block.tex}
          rows={1}
          spellCheck={false}
          aria-label="수식 (LaTeX)"
          placeholder="LaTeX로 입력 (예: E = mc^2, \frac{a}{b}, \sum_{i=1}^{n} i)"
          onChange={(e) => onChange({ ...block, tex: e.target.value })}
          onBlur={() => block.tex.trim() && setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault()
              e.stopPropagation()
              if (block.tex.trim()) setEditing(false)
            }
          }}
          className="block w-full resize-none rounded-lg bg-muted px-3 py-2 font-mono text-sm leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/60"
        />
      )}
      {rendered && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="눌러서 수식 고치기"
          className="block w-full overflow-x-auto rounded-lg px-3 py-1 text-left text-foreground hover:bg-accent/60"
        >
          {rendered.error ? (
            <span className="text-sm text-amber-700">수식을 읽지 못했어요. 눌러서 고쳐 주세요.</span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: rendered.html }} />
          )}
        </button>
      )}
    </div>
  )
}
