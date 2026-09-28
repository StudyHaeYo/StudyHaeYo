import type {
  Category,
  StudyRecord,
  ChecklistItem,
  CategoryStat,
} from "./types"

export const categories: Category[] = [
  {
    id: "major",
    name: "전공 공부",
    children: [
      { id: "ds", name: "자료구조" },
      { id: "os", name: "운영체제" },
    ],
  },
  {
    id: "cert",
    name: "자격증",
    children: [{ id: "eng-processing", name: "정보처리기사" }],
  },
  {
    id: "lang",
    name: "어학",
  },
]

export const records: StudyRecord[] = [
  {
    id: "r1",
    title: "해시 테이블 충돌 해결 방법 정리",
    category: "자료구조",
    type: "정리",
    createdAt: "오전 9:24",
    understanding: 3,
    reviewDate: "9월 30일",
  },
  {
    id: "r2",
    title: "프로세스와 스레드 차이 강의 수강",
    category: "운영체제",
    type: "강의",
    createdAt: "오전 11:02",
    understanding: 2,
    reviewDate: "9월 29일",
  },
  {
    id: "r3",
    title: "정보처리기사 실기 기출 3회분 풀이",
    category: "정보처리기사",
    type: "문제풀이",
    createdAt: "오후 2:15",
    understanding: 3,
    reviewDate: "10월 1일",
  },
  {
    id: "r4",
    title: "어제 배운 정렬 알고리즘 복습",
    category: "자료구조",
    type: "복습",
    createdAt: "오후 4:40",
    understanding: 4,
    reviewDate: "10월 4일",
  },
]

export const checklist: ChecklistItem[] = [
  { id: "c1", label: "자료구조 3장 읽기", done: true },
  { id: "c2", label: "운영체제 강의 2개 수강", done: true },
  { id: "c3", label: "정보처리기사 기출 풀기", done: false },
  { id: "c4", label: "영단어 30개 암기", done: false },
]

export const weeklyStats: CategoryStat[] = [
  { category: "자료구조", count: 12 },
  { category: "운영체제", count: 8 },
  { category: "정보처리기사", count: 6 },
  { category: "어학", count: 3 },
]

export const weeklyGoal = { current: 29, target: 40 }
