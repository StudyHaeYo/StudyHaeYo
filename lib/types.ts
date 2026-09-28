export type StudyType = "강의" | "문제풀이" | "복습" | "정리"

export interface Category {
  id: string
  name: string
  children?: Category[]
}

export interface StudyRecord {
  id: string
  title: string
  category: string
  type: StudyType
  createdAt: string
  understanding?: number
  reviewDate?: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface CategoryStat {
  category: string
  count: number
}
