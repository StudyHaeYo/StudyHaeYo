"use client"

import { useState } from "react"
import { Eye, EyeOff, Plus } from "lucide-react"
import { gradeAnswer, hasValidAnswer, questionPool, type Question } from "@/lib/quiz"

export function QuizTab() {
  const [count, setCount] = useState(2)
  const [round, setRound] = useState(0)

  const generateMore = () => {
    setCount((c) => Math.min(c + 2, questionPool.length))
    setRound((r) => r + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      {questionPool.slice(0, count).map((q, i) => (
        <QuestionCard key={`${round}-${q.id}`} number={i + 1} question={q} />
      ))}

      {count < questionPool.length && (
        <button
          onClick={generateMore}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          <Plus className="size-4" />
          문제 더 만들기
        </button>
      )}
    </div>
  )
}

function QuestionCard({ number, question }: { number: number; question: Question }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)

  const options = Array.isArray(question?.options) ? question.options : []
  const gradable = hasValidAnswer(question)
  const result = selected === null ? null : gradeAnswer(question, selected)

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-relaxed text-card-foreground">
          <span className="mr-1.5 text-indigo-600">Q{number}.</span>
          {question?.prompt ?? "문제를 불러오지 못했어요."}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {result === "correct" && (
            <span
              role="status"
              aria-label="정답"
              className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-600"
            >
              O
            </span>
          )}
          {result === "incorrect" && (
            <span
              role="status"
              aria-label="오답"
              className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-base font-bold text-rose-600"
            >
              X
            </span>
          )}
          <button
            onClick={() => setShowAnswer((v) => !v)}
            aria-pressed={showAnswer}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {showAnswer ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showAnswer ? "정답 숨기기" : "정답 보기"}
          </button>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((option, i) => {
          const isAnswer = gradable && i === question.answer
          const isSelected = selected === i
          const highlightCorrect = isAnswer && (showAnswer || result === "correct")
          const highlightWrong = isSelected && result === "incorrect"
          return (
            <li key={`${i}-${option}`}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  highlightWrong
                    ? "border-rose-300 bg-rose-50 font-medium text-rose-700"
                    : highlightCorrect
                      ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-700"
                      : isSelected
                        ? "border-indigo-300 text-foreground"
                        : "border-border text-foreground hover:bg-accent"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    highlightWrong
                      ? "bg-rose-600 text-white"
                      : highlightCorrect
                        ? "bg-indigo-600 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                {option}
              </button>
            </li>
          )
        })}
      </ul>
      {result === "ungradable" && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          이 문제는 정답 데이터가 없어 채점할 수 없어요.
        </p>
      )}
    </section>
  )
}
