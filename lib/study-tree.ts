// Example seed only (folder > subject). The workspace itself has no fixed depth;
// see lib/workspace.ts. Pages live in lib/study-pages.ts and point at any parent via parentId.
export interface WeeklyGoal {
  id: string
  label: string
  done: boolean
}

export interface SubjectNode {
  id: string
  name: string
  weeklyGoals: WeeklyGoal[]
}

export interface StudyGroup {
  id: string
  name: string
  subjects: SubjectNode[]
}

export const studyTree: StudyGroup[] = [
  {
    id: "major",
    name: "전공 공부",
    subjects: [
      {
        id: "ds",
        name: "자료구조",
        weeklyGoals: [
          { id: "ds-g1", label: "자료구조 3장 읽기", done: true },
          { id: "ds-g2", label: "해시 충돌 해결 방식 정리", done: true },
          { id: "ds-g3", label: "정렬 알고리즘 문제 5개 풀기", done: false },
        ],
      },
      {
        id: "os",
        name: "운영체제",
        weeklyGoals: [
          { id: "os-g1", label: "CPU 스케줄링 강의 듣기", done: false },
          { id: "os-g2", label: "교착상태 조건 암기", done: false },
        ],
      },
    ],
  },
  {
    id: "cert",
    name: "자격증",
    subjects: [
      {
        id: "engineer",
        name: "정보처리기사",
        weeklyGoals: [
          { id: "eng-g1", label: "실기 기출 2회분 풀기", done: true },
          { id: "eng-g2", label: "SQL 파트 오답 정리", done: false },
          { id: "eng-g3", label: "보안 용어 복습", done: false },
        ],
      },
    ],
  },
  {
    id: "lang",
    name: "어학",
    subjects: [],
  },
]

export function findSubject(id: string) {
  for (const group of studyTree) {
    const subject = group.subjects.find((s) => s.id === id)
    if (subject) return { group, subject }
  }
  return null
}
