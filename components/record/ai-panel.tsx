"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  FilePlus2,
  FileText,
  Loader2,
  NotebookPen,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import {
  ANSWER_HEADING,
  answerToPageBlocks,
  askStudyAI,
  markdownToBlocks,
  MAX_AI_PDFS,
  pageContextText,
  pagePdfs,
  parseScore,
  scoreToUnderstanding,
  type ChatMessage,
} from "@/lib/ai"
import { blocksPlainText, unresolvedConfusionCount, type StudyPage, type TextBlock } from "@/lib/study-pages"
import { openQuickRecord } from "@/components/record/quick-record-dialog"

const blockClass: Record<TextBlock["type"], string> = {
  h1: "text-base font-semibold pt-2",
  h2: "text-[15px] font-semibold pt-2",
  h3: "text-sm font-semibold pt-1",
  p: "text-sm leading-relaxed",
  li: "text-sm leading-relaxed pl-4 relative before:absolute before:left-1 before:content-['•'] before:text-muted-foreground",
  ol: "text-sm leading-relaxed pl-4",
  todo: "text-sm leading-relaxed pl-4 relative before:absolute before:left-0.5 before:content-['☐'] before:text-muted-foreground",
  toggle: "text-sm font-medium leading-relaxed",
  quote: "text-sm leading-relaxed border-l-2 border-foreground/50 pl-3 text-muted-foreground",
  callout: "text-sm leading-relaxed rounded-md bg-background/70 px-3 py-2",
  code: "rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap",
  concept: "text-sm leading-relaxed pl-4 relative before:absolute before:left-0.5 before:content-['◆'] before:text-[10px] before:top-1 before:text-indigo-500",
  confusion: "text-sm leading-relaxed pl-4 relative before:absolute before:left-0.5 before:content-['?'] before:text-amber-600",
}

export interface AiPanelProps {
  page: StudyPage
  open: boolean
  onClose: () => void
  // Adds blocks at the end of the page body.
  onInsert: (blocks: TextBlock[]) => void
  // Adds 헷갈린 점 blocks (from a grading answer), skipping ones already open on the page.
  onAddConfusions: (texts: string[]) => void
}

// AI 학습 도우미, as a panel on the right of any page (full screen on phones). One chat per open page:
// it stays while the panel is closed and is gone when the page is left (nothing is saved).
// Ask in your own words, or tap a suggestion. No material → general knowledge (the answer says so);
// a problem-set PDF → send your answers and it grades them, ending with "점수: 4/5" → [기록으로 남기기].
export function AiPanel({ page, open, onClose, onInsert, onAddConfusions }: AiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // PDFs (block ids) sent along with every question until turned off.
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const pdfs = pagePdfs(page)
  const picked = pdfs.filter((p) => p.stored && pickedIds.includes(p.block.id)).map((p) => p.block)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const topic = page.title.trim()
  const hasBody = blocksPlainText(page.blocks).trim().length > 0
  const quickPrompts =
    picked.length > 0
      ? ["PDF 핵심을 쪽별로 요약해줘", "PDF 내용으로 확인 문제 5개 만들어줘", "이 PDF는 문제집이야. 내가 답을 보내면 채점해줘"]
      : hasBody
        ? [
            "핵심 개념 정리해줘",
            "확인 문제 5개 만들어줘",
            "시험 대비 정리 노트로 만들어줘",
            ...(unresolvedConfusionCount(page) > 0 ? ["헷갈린 점을 쉽게 설명해줘"] : []),
          ]
        : topic
          ? [`${topic} 핵심 정리 노트 만들어줘`, `${topic} 확인 문제 5개 만들어줘`]
          : []

  const togglePdf = (id: string) =>
    setPickedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_AI_PDFS)))

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || pending) return
    const next: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages(next)
    setDraft("")
    setError(null)
    setPending(true)
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }))
    const result = await askStudyAI(pageContextText(page), next, picked)
    setPending(false)
    if (result.ok) setMessages([...next, { role: "assistant", content: result.text }])
    else setError(result.message)
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(draft)
  }

  return (
    <aside
      aria-label="AI 학습 도우미"
      className={`fixed inset-0 z-40 flex-col ${open ? "flex" : "hidden"} bg-card md:inset-y-0 md:left-auto md:w-[420px] md:border-l md:border-border md:shadow-xl`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
          <Sparkles className="size-4 text-indigo-600" aria-hidden="true" />
          AI 학습 도우미
        </h2>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([])
                setError(null)
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              새 대화
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="AI 도우미 닫기"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !pending && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {hasBody || picked.length > 0
                ? "이 페이지 내용으로 정리하거나 문제를 만들어요. 문제를 풀고 답을 보내면 채점해요."
                : topic
                  ? `아직 본문이 없어요. "${topic}"을(를) 주제로 일반 지식으로 만들어 드려요.`
                  : "공부할 주제를 적어 보세요. 예: 운영체제 교착상태 핵심 정리해줘"}
            </p>
            {quickPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message, i) =>
          message.role === "user" ? (
            <p key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white">
              {message.content}
            </p>
          ) : (
            <AssistantMessage
              key={i}
              page={page}
              content={message.content}
              onInsert={onInsert}
              onAddConfusions={onAddConfusions}
            />
          ),
        )}

        {pending && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {picked.length > 0 ? "PDF를 읽고 생각하는 중이에요…" : "생각하는 중이에요…"}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-border p-3">
        {pdfs.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">PDF도 같이 보기</span>
            {pdfs.map(({ block, stored }) => {
              const on = pickedIds.includes(block.id) && stored
              return (
                <button
                  key={block.id}
                  type="button"
                  disabled={!stored || pending}
                  aria-pressed={on}
                  onClick={() => togglePdf(block.id)}
                  title={stored ? `질문할 때 "${block.name}"도 함께 보내요` : "저장되지 않은 PDF라 AI에 보낼 수 없어요. 다시 올려 주세요"}
                  className={`inline-flex max-w-48 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-border bg-background text-muted-foreground hover:border-indigo-200 hover:text-foreground"
                  }`}
                >
                  {on ? <Check className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
                  <span className="truncate">{block.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5">
          <textarea
            ref={inputRef}
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
            placeholder={messages.length > 0 ? "답이나 질문을 보내세요 (예: 1번 ②, 2번 스택)" : "무엇을 도와줄까요?"}
            aria-label="AI에게 질문"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 [field-sizing:content]"
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
        <p className="mt-1.5 text-[11px] text-muted-foreground">AI 답은 틀릴 수 있어요. 중요한 내용은 교재로 확인하세요.</p>
      </div>
    </aside>
  )
}

function AssistantMessage({
  page,
  content,
  onInsert,
  onAddConfusions,
}: {
  page: StudyPage
  content: string
  onInsert: (blocks: TextBlock[]) => void
  onAddConfusions: (texts: string[]) => void
}) {
  const [showAnswers, setShowAnswers] = useState(false)
  const [confusionsAdded, setConfusionsAdded] = useState(false)
  const blocks = markdownToBlocks(content)
  // "## 정답과 해설" and everything after it stays folded, so the questions can be solved first.
  const answerAt = blocks.findIndex((b) => (b.type === "h1" || b.type === "h2" || b.type === "h3") && ANSWER_HEADING.test(b.text))
  const score = parseScore(content)
  // The score shows as a badge, so its "점수: 4/5" line is left out of the text.
  const visible = (answerAt === -1 || showAnswers ? blocks : blocks.slice(0, answerAt)).filter(
    (b) => !(score && b.type === "p" && /^점수\s*[:：]/.test(b.text)),
  )
  const confusions = blocks.filter((b) => b.type === "confusion").map((b) => b.text)

  const insert = () => {
    const pageBlocks = answerToPageBlocks(content)
    if (pageBlocks.length === 0) return
    onInsert([{ id: pageBlocks[0].id + "-h", type: "h3", text: "AI 정리" }, ...pageBlocks])
    toast.success("본문 끝에 추가했어요")
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success("복사했어요")
    } catch {
      toast.error("복사하지 못했어요")
    }
  }

  return (
    <div className="flex flex-col gap-2 self-stretch">
      <div className="flex flex-col gap-1.5 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3 text-foreground">
        {visible.map((block, i, all) => (
          <p key={block.id} className={`whitespace-pre-wrap ${blockClass[block.type]}`}>
            {block.type === "ol" && <span className="tabular-nums text-muted-foreground">{olNumber(all, i)}. </span>}
            {block.text}
          </p>
        ))}
        {answerAt !== -1 && (
          <button
            type="button"
            onClick={() => setShowAnswers((v) => !v)}
            aria-expanded={showAnswers}
            className="mt-1 inline-flex items-center gap-1 self-start rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            <ChevronDown className={`size-3.5 transition-transform ${showAnswers ? "rotate-180" : ""}`} />
            {showAnswers ? "정답 접기" : "정답과 해설 보기"}
          </button>
        )}
        {score && (
          <p className="mt-1 self-start rounded-md bg-background px-2.5 py-1 text-sm font-semibold tabular-nums text-foreground">
            {`점수 ${score.correct} / ${score.total}`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {score && (
          <button
            type="button"
            onClick={() =>
              openQuickRecord({
                pageId: page.id,
                understanding: scoreToUnderstanding(score),
                studyContent: `AI 문제 풀이 ${score.correct}/${score.total}`,
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <NotebookPen className="size-3.5" />
            기록으로 남기기
          </button>
        )}
        {confusions.length > 0 && (
          <button
            type="button"
            disabled={confusionsAdded}
            onClick={() => {
              onAddConfusions(confusions)
              setConfusionsAdded(true)
              toast.success(`헷갈린 점 ${confusions.length}개를 페이지에 추가했어요`)
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <CircleHelp className="size-3.5" />
            {confusionsAdded ? "헷갈린 점에 추가함" : "헷갈린 점에 추가"}
          </button>
        )}
        <button
          type="button"
          onClick={insert}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <FilePlus2 className="size-3.5" />
          본문에 추가
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Copy className="size-3.5" />
          복사
        </button>
      </div>
    </div>
  )
}

// Number for an "ol" line: its place in the run of consecutive ol lines.
function olNumber(blocks: TextBlock[], index: number) {
  let n = 1
  for (let i = index - 1; i >= 0 && blocks.at(i)?.type === "ol"; i--) n += 1
  return n
}
