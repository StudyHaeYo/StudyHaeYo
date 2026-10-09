"use client"

import { useState } from "react"
import Link from "next/link"
import { Brain, Check, CheckCircle2, ChevronDown, HelpCircle, RotateCcw } from "lucide-react"
import { newItemId, splitConcept, type StudyNoteContent } from "@/lib/study-pages"

export type ReviewAnswer = "remembered" | "confused"

export interface ReviewResult {
  understanding: number
  durationMinutes: number
  remembered: string[]
  confused: string[]
}

export interface ReviewBodyProps {
  note: StudyNoteContent
  exitHref: string
  onChangeNote: (note: StudyNoteContent) => void
  onComplete: (result: ReviewResult) => void
}

const understandingLabels = ["", "거의 모름", "조금 앎", "보통", "대부분 앎", "완벽히 앎"]

export function StudyNoteReview({ note, exitHref, onChangeNote, onComplete }: ReviewBodyProps) {
  const [startedAt] = useState(() => Date.now())
  const [answers, setAnswers] = useState<Record<string, ReviewAnswer>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [understanding, setUnderstanding] = useState<number | null>(null)

  const concepts = note.concepts.filter((c) => c.text.trim())
  const answered = concepts.filter((c) => answers[c.id]).length
  const allDone = answered === concepts.length

  const answer = (conceptId: string, text: string, value: ReviewAnswer) => {
    const previous = answers[conceptId]
    setAnswers((a) => ({ ...a, [conceptId]: value }))
    setOpenId(null)
    if (value === "confused" && previous !== "confused") {
      const alreadyOpen = note.confusions.some((q) => !q.resolved && q.text.trim() === text.trim())
      if (!alreadyOpen) {
        onChangeNote({ ...note, confusions: [...note.confusions, { id: newItemId("q"), text, resolved: false }] })
      }
    }
  }

  const finish = () => {
    if (understanding === null) return
    const termOf = (text: string) => splitConcept(text).term ?? text
    onComplete({
      understanding,
      durationMinutes: Math.max(1, Math.round((Date.now() - startedAt) / 60_000)),
      remembered: concepts.filter((c) => answers[c.id] === "remembered").map((c) => termOf(c.text)),
      confused: concepts.filter((c) => answers[c.id] === "confused").map((c) => termOf(c.text)),
    })
  }

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-indigo-600" aria-hidden="true" />
          <h2 id="review-heading" className="text-sm font-semibold text-indigo-700">
            복습 모드
          </h2>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {`핵심 개념 ${answered}/${concepts.length} 확인`}
          </span>
        </div>
        <Link href={exitHref} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          전체 노트 보기
        </Link>
      </div>

      {concepts.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm leading-relaxed text-muted-foreground">
          아직 정리된 핵심 개념이 없어요. 바로 이해도를 기록하거나, 전체 노트에서 개념을 먼저 추가해보세요.
        </p>
      )}

      {!allDone && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {concepts.map((concept, index) => {
            const { term, detail } = splitConcept(concept.text)
            const result = answers[concept.id]
            const open = openId === concept.id
            return (
              <li key={concept.id}>
                <div
                  className={`flex h-full flex-col rounded-xl border bg-card shadow-sm transition-colors ${
                    result === "remembered"
                      ? "border-emerald-200"
                      : result === "confused"
                        ? "border-amber-200"
                        : open
                          ? "border-indigo-300"
                          : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : concept.id)}
                    className="flex items-start justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{`개념 ${index + 1}`}</span>
                      <span className="text-sm font-medium text-card-foreground text-pretty">
                        {term ?? "이 개념을 떠올려보세요"}
                      </span>
                    </span>
                    {result ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          result === "remembered" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {result === "remembered" ? "기억남" : "헷갈림"}
                      </span>
                    ) : (
                      <ChevronDown
                        className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  {open && (
                    <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
                      <p className="text-sm leading-relaxed text-foreground">{detail}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => answer(concept.id, concept.text, "remembered")}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <Check className="size-4" aria-hidden="true" />
                          기억났어요
                        </button>
                        <button
                          type="button"
                          onClick={() => answer(concept.id, concept.text, "confused")}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          <HelpCircle className="size-4" aria-hidden="true" />
                          헷갈려요
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {allDone && (
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card px-6 py-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-card-foreground">복습 완료</h3>
              {concepts.length > 0 && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {`기억남 ${concepts.filter((c) => answers[c.id] === "remembered").length}개 · 헷갈림 ${concepts.filter((c) => answers[c.id] === "confused").length}개`}
                  {concepts.some((c) => answers[c.id] === "confused") && " — 헷갈린 개념은 헷갈린 점 목록에 추가했어요."}
                </p>
              )}
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium text-card-foreground">
              <Brain className="size-4 text-indigo-600" aria-hidden="true" />
              지금 이해도는 어느 정도인가요?
            </legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={understanding === value}
                  onClick={() => setUnderstanding(value)}
                  className={`flex min-w-16 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    understanding === value
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border bg-background text-foreground hover:border-indigo-300"
                  }`}
                >
                  <span className="font-semibold">{value}</span>
                  <span className={`text-xs ${understanding === value ? "text-indigo-100" : "text-muted-foreground"}`}>
                    {understandingLabels[value]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={understanding === null}
              onClick={finish}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              확인하고 학습 기록 남기기
            </button>
            <p className="text-xs text-muted-foreground">복습에 걸린 시간과 함께 학습 기록 1개가 추가돼요.</p>
          </div>
        </div>
      )}
    </section>
  )
}
