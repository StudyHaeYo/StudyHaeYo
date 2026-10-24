import {
  isTextBlock,
  newBlockId,
  structuredBlockLines,
  textBlockWords,
  type AttachmentBlock,
  type Block,
  type StudyPage,
  type TextBlock,
} from "@/lib/study-pages"

// AI 학습 도우미 (client side). The browser never sees the API key: it calls our route (app/api/ai/chat/route.ts),
// which checks the session and calls Claude. Chat history lives only in the open page (not saved).

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export type AiResult = { ok: true; text: string } | { ok: false; message: string }

export const MAX_CONTEXT_CHARS = 20_000

function lineOf(block: TextBlock) {
  const words = textBlockWords(block)
  if (block.type === "concept") return `[핵심 개념] ${words}`
  if (block.type === "confusion") return `[헷갈린 점${block.checked ? ", 해결함" : ""}] ${words}`
  return words
}

const textOf = (blocks: Block[]) =>
  blocks
    .flatMap((b) => (isTextBlock(b) ? (textBlockWords(b).trim() ? [lineOf(b)] : []) : structuredBlockLines(b)))
    .join("\n")

// What the AI reads: title, body (핵심 개념 / 헷갈린 점 blocks are labeled), and the latest study records.
export function pageContextText(page: StudyPage) {
  const parts = [`제목: ${page.title || "제목 없음"}`]
  parts.push(`[본문]\n${textOf(page.blocks) || "(비어 있음)"}`)
  const records = [...page.studyRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  if (records.length > 0)
    parts.push(
      `[최근 학습 기록]\n${records
        .map((r) => `- ${r.date} ${r.durationMinutes}분, 이해도 ${r.understanding}/5: ${r.studyContent}${r.difficulties ? ` / 어려웠던 점: ${r.difficulties}` : ""}`)
        .join("\n")}`,
    )
  return parts.join("\n\n").slice(0, MAX_CONTEXT_CHARS)
}

// At most this many PDFs go along with one question (the server checks it too).
export const MAX_AI_PDFS = 2

// PDFs in the page the AI could read. Only files saved to Storage (`path`) can be sent; ones that live
// only in this tab are listed with `stored: false` so the screen can say why they can't be picked.
export function pagePdfs(page: StudyPage): { block: AttachmentBlock; stored: boolean }[] {
  return page.blocks
    .filter((b): b is AttachmentBlock => (b.type === "file" || b.type === "image") && b.mime === "application/pdf")
    .map((block) => ({ block, stored: Boolean(block.path) }))
}

export async function askStudyAI(context: string, messages: ChatMessage[], pdfs: AttachmentBlock[] = []): Promise<AiResult> {
  try {
    const attachments = pdfs
      .filter((b) => b.path)
      .slice(0, MAX_AI_PDFS)
      .map((b) => ({ path: b.path, name: b.name }))
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(attachments.length > 0 ? { context, messages, attachments } : { context, messages }),
    })
    const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null
    if (!res.ok || !data?.text) return { ok: false, message: data?.error ?? "AI가 답하지 못했어요. 잠시 후 다시 시도해 주세요." }
    return { ok: true, text: data.text }
  } catch {
    return { ok: false, message: "네트워크 문제로 AI에 연결하지 못했어요." }
  }
}

const clean = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")

// The AI answers in a small markdown subset (# headings, - lists, ``` code); turn it into page blocks.
// List lines under a "핵심 개념" heading become concept blocks (복습 카드), under "헷갈린 점" confusion blocks.
export function markdownToBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = []
  let code: string[] | null = null
  let section: "concept" | "confusion" | null = null
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    if (raw.trim().startsWith("```")) {
      if (code) {
        blocks.push({ id: newBlockId(), type: "code", text: code.join("\n") })
        code = null
      } else code = []
      continue
    }
    if (code) {
      code.push(raw)
      continue
    }
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue
    // Multiple-choice options ("① … ② …") stay with their numbered question, so the numbering keeps running.
    const prev = blocks.at(-1)
    if (/^[①-⑩]/.test(line) && prev?.type === "ol") {
      prev.text += "\n" + clean(line)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = Math.min(heading[1].length, 3)
      const title = clean(heading[2])
      section = /핵심\s*개념/.test(title) ? "concept" : /헷갈/.test(title) ? "confusion" : null
      blocks.push({ id: newBlockId(), type: (["h1", "h2", "h3"] as const)[level - 1], text: title })
    } else if (/^[-*]\s+\[( |x|X)\]\s+/.test(line)) {
      const checked = /^[-*]\s+\[(x|X)\]/.test(line)
      blocks.push({ id: newBlockId(), type: "todo", text: clean(line.replace(/^[-*]\s+\[( |x|X)\]\s+/, "")), checked })
    } else if (/^\d+[.)]\s+/.test(line)) {
      blocks.push({ id: newBlockId(), type: "ol", text: clean(line.replace(/^\d+[.)]\s+/, "")) })
    } else if (/^>\s?/.test(line)) {
      blocks.push({ id: newBlockId(), type: "quote", text: clean(line.replace(/^>\s?/, "")) })
    } else if (/^[-*•]\s+/.test(line)) {
      blocks.push({ id: newBlockId(), type: section ?? "li", text: clean(line.replace(/^[-*•]\s+/, "")) })
    } else {
      blocks.push({ id: newBlockId(), type: "p", text: clean(line) })
    }
  }
  if (code) blocks.push({ id: newBlockId(), type: "code", text: code.join("\n") })
  return blocks
}

// "점수: 4/5" on the last lines of a grading answer (the prompt asks for exactly this line).
export function parseScore(text: string): { correct: number; total: number } | null {
  const matches = [...text.matchAll(/점수\s*[:：]\s*(\d+)\s*\/\s*(\d+)/g)]
  const last = matches.at(-1)
  if (!last) return null
  const correct = Number(last[1])
  const total = Number(last[2])
  return total > 0 && correct <= total ? { correct, total } : null
}

// 0% → 1, 100% → 5: a starting value for the record's 이해도, which the user can change.
export function scoreToUnderstanding({ correct, total }: { correct: number; total: number }) {
  return Math.min(5, Math.max(1, Math.round((correct / total) * 4) + 1))
}

export const ANSWER_HEADING = /^정답\s*(과|및)?\s*해설/

// Lines the AI says to the user rather than about the topic: "…만들어 드릴까요?", "답을 보내 주면 채점해 드릴게요."
const CHAT_LINE =
  /(\?|？|까요[.!]?|드릴게요[.!]?|드리겠습니다[.!]?|드려요[.!]?|보내\s*주(세요|면)[^.]*[.!]?|말씀해\s*주세요[.!]?|알려\s*주세요[.!]?|원하시면[^.]*[.!]?)\s*$/
const isChatLine = (b: TextBlock) => b.type === "p" && CHAT_LINE.test(b.text.trim())

// What goes into the page from an answer: the content without the chat around it (opening and closing
// lines addressed to the user, the "점수: 4/5" line). The "자료 없이 만든 내용" warning (a quote) stays.
export function answerToPageBlocks(markdown: string): TextBlock[] {
  const blocks = markdownToBlocks(markdown).filter((b) => !(b.type === "p" && /^점수\s*[:：]/.test(b.text)))
  let start = 0
  let end = blocks.length
  while (start < end && isChatLine(blocks[start])) start++
  while (end > start && isChatLine(blocks[end - 1])) end--
  return blocks.slice(start, end)
}
