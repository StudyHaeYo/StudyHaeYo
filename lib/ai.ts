import {
  blocksPlainText,
  conceptBlocks,
  isTextBlock,
  newBlockId,
  structuredBlockLines,
  textBlockWords,
  unresolvedConfusionCount,
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

// ── 확인 문제 (D-32) ──────────────────────────────────────────────────────────────────────────────────────
// 하 = 용어와 정의, 중 = 예제에 적용, 상 = 비교하고 이유 설명. Mixed problems measure 이해도; one level is practice.
export const quizLevels = ["하", "중", "상"] as const
export type QuizLevel = (typeof quizLevels)[number]
export type LevelScore = Partial<Record<QuizLevel, { correct: number; total: number }>>

// How many problems, from how much the note holds: one per 핵심 개념 (no concepts: one per ~400 characters of
// body, or 5 for a PDF or a bare topic), plus up to 2 from open 헷갈린 점; 3 to 10 in all. Mixed is 하 40% · 중 40%
// · 상 20% with at least one 상. ("새로 공부한 양만" needs the last quiz time saved; that comes with the data change.)
export function quizPlan(page: StudyPage, withPdf: boolean) {
  const concepts = conceptBlocks(page.blocks).length
  const bodyChars = blocksPlainText(page.blocks).trim().length
  const fromBody = concepts > 0 ? concepts : withPdf || bodyChars === 0 ? 5 : Math.ceil(bodyChars / 400)
  const confusions = Math.min(2, unresolvedConfusionCount(page))
  const total = Math.max(3, Math.min(10, fromBody + confusions))
  const high = Math.max(1, Math.round(total * 0.2))
  const low = Math.round(total * 0.4)
  return { total, concepts, confusions, levels: { 하: low, 중: total - low - high, 상: high } satisfies Record<QuizLevel, number> }
}

// The message the [확인 문제] buttons send (shown in the chat as the user's words).
export function quizPrompt(plan: ReturnType<typeof quizPlan>, level: QuizLevel | null) {
  const fromConfusions = plan.confusions > 0 ? `, 그중 ${plan.confusions}문제는 아직 안 풀린 헷갈린 점에서` : ""
  if (level) return `${level} 문제만 ${plan.total}개 만들어줘 (연습)${fromConfusions}.`
  const { 하: low, 중: mid, 상: high } = plan.levels
  return `확인 문제 ${plan.total}개 만들어줘. 하 ${low} · 중 ${mid} · 상 ${high}${fromConfusions}.`
}

// "점수: 하 2/2 · 중 1/2 · 상 0/1" (or the older "점수: 4/5") on the last lines of a grading answer.
export function parseScore(text: string): { correct: number; total: number; levels: LevelScore | null } | null {
  const line = [...text.matchAll(/점수\s*[:：]\s*([^\n]+)/g)].at(-1)?.[1]
  if (!line) return null
  const levels: LevelScore = {}
  for (const m of line.matchAll(/([하중상])\s*(\d+)\s*\/\s*(\d+)/g)) {
    const correct = Number(m[2])
    const total = Number(m[3])
    if (total > 0 && correct <= total) levels[m[1] as QuizLevel] = { correct, total }
  }
  const parts = Object.values(levels)
  if (parts.length > 0)
    return { correct: parts.reduce((n, s) => n + s.correct, 0), total: parts.reduce((n, s) => n + s.total, 0), levels }
  const plain = line.match(/^\s*(\d+)\s*\/\s*(\d+)/)
  if (!plain) return null
  const correct = Number(plain[1])
  const total = Number(plain[2])
  return total > 0 && correct <= total ? { correct, total, levels: null } : null
}

// A level is passed with every problem right, or one wrong when it has 3 or more (80% would mean "all right"
// for the 1–4 problems a level usually has).
export function passedLevel(s: { correct: number; total: number }) {
  return s.total > 0 && s.correct >= s.total - (s.total >= 3 ? 1 : 0)
}

const levelBase: Record<QuizLevel, number> = { 하: 1, 중: 2, 상: 3 }

// 사다리: climb from the lowest level asked. Failing it gives its base (none right) or base + 1 (some right);
// passing gives base + 2, and each next level passed adds 1. Mixed → 하 1·2·3, 중 4, 상 5. One level (practice)
// stays in its range: 하 1–3, 중 2–4, 상 3–5, so easy problems alone never make 5.
export function ladderUnderstanding(levels: LevelScore): number | null {
  const asked = quizLevels.filter((l) => (levels[l]?.total ?? 0) > 0)
  const first = asked[0]
  if (!first) return null
  const start = levels[first]!
  if (!passedLevel(start)) return levelBase[first] + (start.correct > 0 ? 1 : 0)
  let value = levelBase[first] + 2
  for (const l of asked.slice(1)) {
    if (!passedLevel(levels[l]!)) break
    value += 1
  }
  return Math.min(5, value)
}

const levelAdvice: Record<QuizLevel, string> = {
  하: "용어와 정의부터 다시 보세요",
  중: "예제에 적용해 보는 연습이 필요해요",
  상: "비교하고 이유를 설명하는 연습이 필요해요",
}

// One line of feedback by level (no AI): where the climb stopped and what to practice.
export function ladderFeedback(levels: LevelScore) {
  const asked = quizLevels.filter((l) => (levels[l]?.total ?? 0) > 0)
  const stuck = asked.find((l) => !passedLevel(levels[l]!))
  if (!stuck) return asked.includes("상") ? "상까지 통과했어요. 설명할 수 있는 수준이에요." : `${asked.at(-1)}까지 통과했어요.`
  return `${stuck}에서 막혔어요. ${levelAdvice[stuck]}.`
}

// 이해도 a score suggests for the record (the user can change it): the ladder when levels were marked,
// otherwise 0% → 1, 100% → 5.
export function scoreToUnderstanding(score: { correct: number; total: number; levels?: LevelScore | null }) {
  const ladder = score.levels ? ladderUnderstanding(score.levels) : null
  if (ladder !== null) return ladder
  return Math.min(5, Math.max(1, Math.round((score.correct / score.total) * 4) + 1))
}

export function formatLevelScore(levels: LevelScore) {
  return quizLevels
    .filter((l) => levels[l])
    .map((l) => `${l} ${levels[l]!.correct}/${levels[l]!.total}`)
    .join(" · ")
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

// Problems of a quiz answer by number ("1. [하] 질문", options ① … on the next lines) and their answers under
// "## 정답과 해설" ("1. ③ — 해설", explanation lines after it).
export function parseQuiz(markdown: string) {
  const problems = new Map<number, { level: QuizLevel | null; text: string }>()
  const answers = new Map<number, string>()
  let inAnswers = false
  let last: number | null = null
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      inAnswers = ANSWER_HEADING.test(clean(heading[1]).trim())
      last = null
      continue
    }
    const numbered = line.match(/^(\d+)[.)]\s+(?:\[([하중상])\]\s*)?(.*)$/)
    if (numbered) {
      last = Number(numbered[1])
      if (inAnswers) answers.set(last, clean(numbered[3]))
      else problems.set(last, { level: (numbered[2] as QuizLevel | undefined) ?? null, text: clean(numbered[3]) })
      continue
    }
    // The score line and the closing "답을 보내 주면 채점해 드릴게요." belong to no problem.
    if (last === null || /^점수\s*[:：]/.test(line) || CHAT_LINE.test(line)) continue
    if (inAnswers) answers.set(last, `${answers.get(last)}\n${clean(line)}`)
    else if (/^[①-⑩]/.test(line)) {
      const problem = problems.get(last)!
      problem.text += `\n${clean(line)}`
    }
  }
  return { problems, answers }
}

// The problems a grading answer marked wrong ("2. 틀림 — 정답 ③. 해설"), with their text from the quiz.
export function wrongFromGrading(quiz: string, grading: string) {
  const { problems, answers } = parseQuiz(quiz)
  const wrong: { level: QuizLevel | null; text: string; answer: string }[] = []
  for (const m of grading.replace(/\r/g, "").matchAll(/^\s*(\d+)[.)]\s*(?:\[[하중상]\]\s*)?틀림\s*[—–:-]?\s*(.*)$/gm)) {
    const problem = problems.get(Number(m[1]))
    if (!problem) continue
    wrong.push({ level: problem.level, text: problem.text, answer: answers.get(Number(m[1])) ?? clean(m[2]) })
  }
  return wrong
}
