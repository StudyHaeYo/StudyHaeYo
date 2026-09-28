export const priorityStudy = {
  subject: "운영체제",
  subjectId: "os",
  pageId: "os-1",
  topic: "프로세스 스레드 차이",
  lastStudied: "2일 전",
  status: "복습 필요",
  reason: "이해도 2/5 · 오늘 복습할 차례예요",
}

export const reviewQueue = [
  { id: "rq1", pageId: "os-1", subject: "운영체제", topic: "프로세스 스레드 차이", lastStudied: "2일 전", understanding: 2, due: "오늘" },
  { id: "rq2", pageId: "ds-2", subject: "자료구조", topic: "정렬 알고리즘 복습", lastStudied: "4일 전", understanding: 3, due: "오늘" },
  { id: "rq3", pageId: "eng-1", subject: "정보처리기사", topic: "실기 기출 3회분", lastStudied: "3일 전", understanding: 3, due: "내일" },
]

export const subjectMastery = [
  { subject: "자료구조", progress: 72 },
  { subject: "운영체제", progress: 48 },
  { subject: "정보처리기사", progress: 61 },
  { subject: "어학", progress: 34 },
]

export const analyticsSummary = {
  totalMinutes: 1740,
  recordCount: 23,
  averageUnderstanding: 3.4,
}

export const upcomingReviews = [
  { id: "ur1", pageId: "eng-1", topic: "실기 기출 3회분", subject: "정보처리기사", date: "9/29" },
  { id: "ur2", pageId: "ds-1", topic: "해시테이블 정리", subject: "자료구조", date: "10/5" },
  { id: "ur3", pageId: "ds-3", topic: "트리 순회 강의 노트", subject: "자료구조", date: "10/5" },
]

export const recentActivity = [
  { id: "ra1", pageId: "ds-1", title: "해시테이블 정리", subject: "자료구조", when: "오늘 · 60분", understanding: 4 },
  { id: "ra2", pageId: "os-1", title: "프로세스 스레드 차이", subject: "운영체제", when: "2일 전 · 35분", understanding: 2 },
  { id: "ra3", pageId: "eng-1", title: "실기 기출 3회분", subject: "정보처리기사", when: "3일 전 · 80분", understanding: 3 },
  { id: "ra4", pageId: "ds-2", title: "정렬 알고리즘 복습", subject: "자료구조", when: "4일 전 · 60분", understanding: 3 },
]

export const reviewOffsetDays: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 }

export function reviewDateLabel(understanding: number, from = new Date()) {
  const date = new Date(from)
  date.setDate(date.getDate() + (reviewOffsetDays[understanding] ?? 4))
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date)
}
