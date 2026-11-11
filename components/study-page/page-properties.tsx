"use client"

import { daysBetween } from "@/lib/study-pages"

// What is left of the 속성 window (D-28 → D-30): the kind is the chip in the top bar and kind values sit at the top
// of the body (kind-head.tsx, exam-scope.tsx). Tags are no longer shown (D-37).

// "D-7" before the exam, "D-day" on it, null once it has passed or when unknown.
export function examCountdown(examDate: string | undefined, today: string | null) {
  if (!examDate || !today) return null
  const days = daysBetween(today, examDate)
  if (days < 0) return null
  return days === 0 ? "D-day" : `D-${days}`
}
