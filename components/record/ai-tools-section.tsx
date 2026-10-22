"use client"

import { useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowUp, Copy, FilePlus2, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { askStudyAI, markdownToBlocks, pageContextText, type ChatMessage } from "@/lib/ai"
import type { StudyPage, TextBlock } from "@/lib/study-pages"

const blockClass: Record<TextBlock["type"], string> = {
  h1: "text-base font-semibold pt-2",
  h2: "text-[15px] font-semibold pt-2",
  h3: "text-sm font-semibold pt-1",
  p: "text-sm leading-relaxed",
  li: "text-sm leading-relaxed pl-4 relative before:absolute before:left-1 before:content-['•'] before:text-muted-foreground",
  code: "rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap",
}

// AI 학습 도우미: chat about this page. Quick prompts for the common asks; any answer can be added to the page body.
export function AiToolsSection({ page, onInsert }: { page: StudyPage; onInsert: (blocks: TextBlock[]) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hasConfusions = (page.note?.confusions.filter((c) => !c.resolved).length ?? 0) > 0
  const quickPrompts = [
    "핵심만 5줄로 요약해줘",
    "시험 대비 정리 노트로 만들어줘",
    "확인 문제 5개 만들어줘",
    ...(hasConfusions ? ["헷갈린 점을 쉽게 설명해줘"] : []),
  ]

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || pending) return
    const next: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(next)
    setDraft("")
    setError(null)
    setPending(true)
    const result = await askStudyAI(pageContextText(page), next)
    setPending(false)
    if (result.ok) setMessages([...next, { role: "assistant", content: result.text }])
    else setError(result.message)
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(draft)
  }

  const insert = (markdown: string) => {
    const blocks = markdownToBlocks(markdown)
    if (blocks.length === 0) return
    onInsert([{ id: blocks[0].id + "-h", type: "h3", text: "AI 정리" }, ...blocks])
    toast.success("본문 끝에 추가했어요")
  }

  const copy = async (markdown: string) => {
    try {
      await navigator.clipboard.writeText(markdown)
      toast.success("복사했어요")
    } catch {
      toast.error("복사하지 못했어요")
    }
  }

  return (
    <section aria-labelledby="ai-tools-heading" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ai-tools-heading" className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
            <Sparkles className="size-4 text-indigo-600" aria-hidden="true" />
            AI 학습 도우미
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            이 페이지 내용으로 정리하거나 문제를 만들어요. 원하는 걸 자유롭게 물어봐도 돼요.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([])
              setError(null)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            새 대화
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div ref={listRef} className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-4">
          {messages.length === 0 && !pending && (
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((message, i) =>
            message.role === "user" ? (
              <p key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white">
                {message.content}
              </p>
            ) : (
              <div key={i} className="flex flex-col gap-2 self-stretch">
                <div className="flex flex-col gap-1.5 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3 text-foreground">
                  {markdownToBlocks(message.content).map((block) => (
                    <p key={block.id} className={blockClass[block.type]}>
                      {block.text}
                    </p>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => insert(message.content)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    <FilePlus2 className="size-3.5" />
                    본문에 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy(message.content)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                    복사
                  </button>
                </div>
              </div>
            ),
          )}

          {pending && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              생각하는 중이에요…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-border p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send(draft)
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="예: 3장 내용으로 객관식 문제 3개 만들어줘"
            aria-label="AI에게 질문"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="보내기"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
      <p className="text-[11px] text-muted-foreground">AI 답은 틀릴 수 있어요. 중요한 내용은 교재로 확인하세요.</p>
    </section>
  )
}
