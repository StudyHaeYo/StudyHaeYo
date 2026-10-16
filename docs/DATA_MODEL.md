# 데이터 모델 (프론트 ↔ 백엔드 계약)

기준 시점: 2026-10-12 (v0 export 코드 기준)

**코드와 다르면 코드가 맞다.** 이 문서는 코드를 읽어서는 알 수 없는 것(규칙, 합의, 의도, 알려진 불일치)을 적는다.
데이터 구조나 규칙을 바꾸는 PR은 이 문서도 같은 PR에서 고친다.

| 내용 | 원본 코드 |
|---|---|
| StudyPage, PageStudyRecord, StudyNoteContent, 파생값 계산 | `lib/study-pages.ts` |
| 그룹, 트리 함수, 페이지 CRUD | `lib/workspace.ts` |
| 페이지 템플릿(페이지 종류) | `lib/templates.ts` |
| 학습 계획 | `lib/plans.ts` |
| 학습 세션/구간 | `lib/study-session.ts` |
| Home 복습 후보 계산 | `lib/study-candidates.ts` |

---

## 1. 엔티티

### StudyPage
| 필드 | 타입 | 메모 |
|---|---|---|
| id | string | 클라이언트가 만든다(`p-<시각><난수>`). 시드는 `ds-1` 같은 값 |
| title | string | |
| parentId | string \| null | 그룹 id **또는 다른 페이지 id**(페이지 아래 페이지 가능). null은 최상위 |
| templateId | `"study-note"` \| `"blank"` | 템플릿 레지스트리의 키. DB에는 이것만 저장한다 |
| createdAt | `"YYYY-MM-DD"` | 날짜 문자열 |
| studyType | `강의｜문제풀이｜복습｜정리` (선택) | |
| blocks | Block[] | 빈 페이지 본문. Block = `{id, type: h1｜h2｜h3｜p｜li｜code, text}` |
| note | StudyNoteContent (선택) | 학습 노트 본문. 아래 참고 |
| tags | string[] | |
| studyRecords | PageStudyRecord[] | 이 페이지의 학습 기록 |
| status | `시작 전｜학습 중｜복습 필요｜완료` (선택) | **사용자가 직접 고른 값.** 없으면 파생 |
| understanding | number 1~5 (선택) | **사용자가 직접 고른 값.** 없으면 최신 기록에서 파생 |
| studyEnabled | boolean (선택) | 학습 기능이 "선택"인 템플릿에서 사용자가 켰는지 |

### StudyNoteContent (학습 노트 본문)
  - `learned`: Block[] — 오늘 배운 내용

### 그림 블록 (`type: "drawing"`)
- `{id, type: "drawing", strokes, height}`. `height`는 px(처음 320, "아래로 늘리기"마다 +120).
- 획(stroke) = `{tool: "pen"｜"highlighter", color, width, points}`. `points`는 `[x, y]` 배열이고, **x와 y 모두 블록 너비를 1로 본 비율**이다. 화면 너비가 달라도 그림 모양이 유지되게 하려는 것이다. `width`는 화면 px라서 확대·축소해도 선 굵기는 그대로다.
- 비트맵이 아닌 좌표로 저장한다. 저장 크기가 작고, 획 단위 지우개와 되돌리기가 쉽기 때문이다.
- 텍스트가 아니므로 AI 도구용 본문 텍스트(`blocksPlainText`)에서는 빠진다. 페이지를 복제하면 획 데이터까지 깊은 복사한다(`cloneBlock`).
- 되돌리기/다시 실행 기록은 블록이 화면에 있는 동안에만 유지되고 저장하지 않는다.
- `concepts`: `{id, text}[]` — 핵심 개념. `"용어: 설명"` 형태로 쓰면 복습 카드의 앞면/뒷면으로 나뉜다(`splitConcept`)
- `confusions`: `{id, text, resolved}[]` — 헷갈린 점. 항목별 해결 여부

### PageStudyRecord (학습 기록)
| 필드 | 타입 | 메모 |
|---|---|---|
| id | string | 새 기록은 `<pageId>-r-<생성 ms>`. 시드는 `ds1-r1` |
| pageId | string | |
| date | `"YYYY-MM-DD"` | 공부한 날 |
| createdAt | number(ms), 선택 | 기록 생성 시각. 세션 시간 중복 집계 판단에 쓴다. 옛 기록은 없을 수 있다 |
| durationMinutes | number | |
| understanding | number 1~5 | |
| studyContent | string | 그 세션에 실제로 한 일. 페이지 본문의 "오늘 배운 내용"과 다르다 |
| difficulties | string | |
| nextSteps | string | |
| tags | string[] | |

### WorkspaceGroup (폴더/과목)
`{id, name, parentId: string | null, kind: "folder" | "subject"}`
- `subject`는 학습 계획과 분석이 가리킬 수 있는 표식이다. 트리 어디에나 둘 수 있고, 페이지에서 가장 가까운 상위 subject가 그 페이지의 과목이다(`nearestSubject`).
- 형제 순서는 `WorkspaceState.order`(그룹과 페이지 전체를 평면으로 편 id 배열)에 있다. 목록에 없는 id는 뒤로 간다.

### LearningPlan
`{id, title, target, startDate, endDate, goal}`
- `target`은 `{scope:"all"}` \| `{scope:"subject", subjectId}` \| `{scope:"page", pageId}`

### 세션 (브라우저 전용, localStorage `studyhaeyo:study-session`)
- `startedAt`, `segments[{pageId,start,end}]`, `openSegment`, `lastActiveAt`, `log: FinishedSession[]`
- `FinishedSession = {id, startedAt, endedAt, segments, autoEnded?}`

### 템플릿 (코드로 정의, DB에 저장하지 않는다)
`{id, name, tagline, treeIcon, bodyTemplate, reviewTemplate?, studyMode, createContent}`
- `studyMode`는 `"locked-on"`(학습 기능이 항상 켜져 있고 끌 수 없음) 또는 `"optional"`(페이지마다 켜고 끔)
- `studyMode`는 템플릿에서 정해지므로 페이지에 따로 저장하지 않는다.

### 없는 것
**User 엔티티가 없다.** 단일 사용자를 가정하고 있고 프로필은 하드코딩이다.

---

## 2. 파생값 — 저장하지 않고 계산한다 (`computePageStats`)

- **최신 기록**: `date` 내림차순(같으면 `id` 내림차순)의 첫 기록
- **understanding** = `page.understanding`(수동) → 없으면 최신 기록의 값 → 없으면 null
- **nextReviewAt** = 최신 기록의 `date` + `reviewOffsetDays[understanding]`일. 기록이 없으면 null
- **reviewOffsetDays** = 이해도 1→1일, 2→2일, 3→4일, 4→7일, 5→14일 (`lib/learning-os.ts`). 값이 없으면 4일
- **status** = `page.status`(수동)가 있으면 그것. 없으면 기록이 없을 때 "시작 전", `nextReviewAt <= 오늘`이면 "복습 필요", 이해도 5면 "완료", 그 외 "학습 중"
- **totalDurationMinutes** = 기록의 `durationMinutes` 합
- **lastStudiedAt** = 최신 기록의 `date`

주의: 수동 이해도가 있으면 다음 복습일 계산에도 그 값이 쓰인다. "오늘"은 브라우저 날짜이고, 서버 렌더/하이드레이션 중에는 null이라 "복습 필요" 판정을 건너뛴다.

---

## 3. 동작 규칙

**R1. 템플릿과 학습 기능**
학습 기능이 켜진 모든 페이지는 템플릿과 무관하게 같은 속성 패널 + 학습 기록 + AI 학습 도구를 가진다. "locked-on" 템플릿은 항상 켜져 있다. "optional" 템플릿은 `studyEnabled`로 결정하고, 이 값이 없는 옛 페이지는 기록이 하나라도 있으면 켜진 것으로 본다. 학습 기능을 꺼도 본문과 기록 데이터는 지우지 않는다.

**R2. Home 복습 후보** (`reviewCandidates`)
- 후보는 "locked-on" 템플릿의 페이지만. 빈 페이지는 학습 기능이 켜져 있어도 제외
- status가 "완료"면 제외. status가 "복습 필요"이거나 `nextReviewAt <= 내일`이면 포함
- 정렬: `nextReviewAt` 오름차순 → 이해도 오름차순 → 미해결 헷갈린 점이 많은 순
- 오늘/내일 표시: `nextReviewAt <= 오늘`이면 "오늘", 아니면 "내일"

**R3. 복습 모드** (`/record/<id>?mode=review`)
- 복습 본문이 정의된 "locked-on" 템플릿(학습 노트)에서만 열린다. 아니면 일반 페이지로 보인다
- 핵심 개념을 카드로 하나씩 확인하고 "기억났어요 / 헷갈려요"를 고른다
- 완료할 때만 반영한다: "헷갈려요"로 고른 개념이 열린 헷갈린 점과 같은 문구가 아니면 `confusions`에 추가하고, 학습 기록을 자동 생성한다(복습 시작부터 경과한 분, 입력한 이해도, `createdAt`=지금). 중간에 나가면 아무것도 저장하지 않는다

**R4. 세션과 구간**
- 홈에서 시작/종료한다. 세션 중 **보이는 탭에서 "locked-on" 페이지(`/record/<id>`)를 열고 있는 동안만** 구간(`pageId, start, end`)으로 기록한다. 빈 페이지에 머문 시간은 기록하지 않는다
- 30초마다 `lastActiveAt`을 갱신한다(heartbeat)
- 탭이 숨겨지거나 `pagehide`되면 열린 구간을 그 시각에 닫는다
- 앱이 다시 로드될 때 열려 있던 구간은 "지금"이 아니라 **마지막 활동 시각**에 닫는다. 세션이 30분 이상 활동이 없었으면 마지막 활동 시각에 세션을 자동 종료한다(`autoEnded`)
- 세션 "경과 시간"(시계 시간)과 "노트에서 보낸 시간"(구간 합)은 다른 값이다
- 종료 후 요약에서 "학습 기록 추가하기"를 누르면 기록 폼에 그 페이지의 시간이 미리 채워진다(수정 가능)

**R5. 세션 시간 중복 집계 방지** (`unrecordedSessionMinutes`)
어떤 세션에서 어떤 페이지의 구간 시간은, 그 세션의 시작~종료(진행 중이면 지금) 사이에 **그 페이지에 만들어진 학습 기록이 하나라도 있으면** 합계에서 제외한다. 기록을 만든 경로(요약 모달, 복습 완료, 직접 추가)는 상관없다. 기록이 없는 페이지의 구간만 "기록되지 않은 세션 시간"으로 더한다.
- 사용자가 미리 채워진 시간을 줄여서 저장하면 그 값이 최종값이다(예: 45분 → 10분이면 10분)
- 기록의 생성 시각은 `createdAt`, 없으면 id 끝의 `-r-<ms>`에서 복원한다. 둘 다 없는 기록(시드)은 어떤 세션에도 속하지 않는다

**R6. 학습 분석 합계**
- 총 학습 시간 = **모든 페이지**(템플릿 무관)의 기록 `durationMinutes` 합 + 기록되지 않은 세션 시간
- 학습 기록 수, 평균 이해도도 모든 페이지의 기록 기준
- 즉 빈 페이지의 기록은 합계에는 들어가지만 Home 복습 후보에서는 빠진다

**R7. 트리**
- 깊이 제한이 없다. 그룹은 그룹/페이지를 담고, 페이지도 하위 페이지를 담는다
- 학습 기록은 트리 노드가 아니다
- 자기 자신이나 자기 하위로는 이동할 수 없다(`canMoveNode`)
- 페이지/그룹을 삭제하면 그 아래의 페이지와 그룹이 모두 함께 삭제된다
- 복제하면 원본 바로 뒤에 `(사본)`이 붙은 페이지가 생기고, 기록도 새 id로 복사된다(기록의 `createdAt`은 원본 그대로)

**R8. 렌더링 (hydration)**
서버 스냅샷은 항상 시드/idle 상태이고, 브라우저 전용 값(오늘 날짜, 세션)은 마운트 이후에만 읽는다. 데이터 로딩 방식을 바꿀 때도 서버 렌더와 클라이언트 첫 렌더 결과가 같아야 한다.

---

## 4. 프론트가 의존하는 함수 (DB 전환 시 교체 지점)

| 파일 | 함수 |
|---|---|
| `lib/workspace.ts` | `useWorkspace()`, `createPage`, `updatePage`, `renamePage`, `duplicatePage`, `deletePage`, `moveNode`, `canMoveNode`, `addGroup` |
| `lib/plans.ts` | `usePlans()`, `addPlan`, `removePlan` |
| `lib/study-session.ts` | 세션 함수들. localStorage 기반이라 서버로 옮길 때 별도 설계가 필요하다 |

DB를 붙일 때는 이 시그니처를 유지하는 어댑터를 우선 고려하면 UI 수정이 최소화된다.
단 `updatePage(id, update)`는 "기존 페이지를 받아 새 페이지를 돌려주는 함수"를 받는다. 서버에서는 "바뀐 필드만 보내는 PATCH"가 자연스러우므로, 이 부분은 프론트 변경이 필요할 수 있어 협의한다.

---

## 5. 알려진 불일치와 주의

1. **새로고침하면 페이지, 기록, 학습 계획이 시드 데이터로 돌아간다.** `createStore`는 메모리 전용이다. localStorage를 쓰는 것은 세션 타이머뿐이다.
2. **정적 더미 위젯은 체크리스트 하나만 남았다.** Home의 나의 학습 상태/오늘의 기록/이번 주 학습 통계, 학습 분석의 과목별 학습 상태/취약 학습 영역/복습 예정/최근 학습 활동은 모두 `lib/study-stats.ts`가 워크스페이스 페이지의 `studyRecords`에서 계산한다.
   - 과목: 페이지의 가장 가까운 상위 과목(`nearestSubject`), 없으면 "내 페이지"
   - 나의 학습 상태 / 과목별 학습 상태: 과목별 기록 `understanding` 평균 ÷ 5 × 100 (기록 없는 과목은 숨김)
   - 오늘의 기록: `date`가 오늘인 기록, 최신순(`createdAt`, 없으면 id의 시각, 그것도 없으면 `date`)
   - 이번 주 학습 통계: 월요일~오늘의 `date` 기준 과목별 `durationMinutes` 합. 목표는 `WEEKLY_GOAL_MINUTES`(600분, 설정 화면과 같은 상수)
   - 취약 학습 영역: 페이지 이해도(R1) ≤ 2 이거나 미해결 헷갈린 점 ≥ 1. 미해결 많은 순 → 이해도 낮은 순, 최대 5개
   - 복습 예정: R2와 같은 페이지 범위(locked-on 템플릿), 상태가 완료가 아니고 다음 복습일이 있는 페이지, 날짜순 최대 5개. 오늘 이전/오늘은 "오늘", 내일은 "내일" 표시
   - 최근 학습 활동: 전체 기록 최신순 5개
   - `lib/learning-os.ts`의 고정값과 `dummy-data.ts`의 records/weeklyStats는 더 이상 화면에서 쓰지 않는다(파일은 남겨둠).
3. **`StudyRecord`가 두 가지다.** `lib/types.ts`의 `StudyRecord`(title/category/type...)는 옛 형태로 과목 화면의 `RecordCard`에만 남아 있고(Home은 더 이상 쓰지 않음), 실제 학습 기록은 `lib/study-pages.ts`의 `PageStudyRecord`다. DB는 `PageStudyRecord` 기준으로 설계한다.
4. `/subject/[id]`는 시드(`lib/study-tree.ts`의 `findSubject`)에서만 과목을 찾는다. 시드에 없는 과목(사용자가 만든 `kind: "subject"` 그룹)은 404가 날 수 있다. 과목 페이지의 주간 목표도 시드 전용이다. (확인 필요)
5. 시드/레거시: `lib/study-tree.ts`는 초기 그룹 시드용, `lib/dummy-data.ts`의 `categories`는 일부 화면에서 아직 쓰인다. `app/ai`, `app/notes`, `app/study`는 링크가 없는 죽은 라우트다(정리 대상).
6. 형식 불일치: 페이지 `createdAt`은 날짜 문자열, 기록 `createdAt`은 ms 숫자. 날짜는 타임존 없는 로컬 날짜 문자열이다.
7. id는 모두 클라이언트가 만든다. DB가 id를 발급하면 프론트와 맞추는 방법을 정해야 한다.
8. `app/page/new/page.tsx`의 옛 경로 리다이렉트는 쿼리 값을 인코딩하지 않는다(`app/record/[id]`는 수정됨).
9. 세션 로그는 localStorage에만 쌓이고 정리 기준이 없다.

---

## 6. 아직 정하지 않은 것

- DB 종류 (Firestore, Supabase/Postgres 등). 트리, 1:N, 시간 창 집계라는 데이터 특성으로 비교한 뒤 두 사람이 결정한다
- 인증과 User 모델
- 세션/구간을 서버에 저장할지 (R5의 중복 집계를 서버에서 하려면 필요하다)
- 형제 순서 저장 방식 (지금의 전역 `order` 배열 vs 부모별 position)
- 날짜/타임존 처리
- 파생값(status, 다음 복습일 등)을 저장할지 계산할지
- id를 누가 발급할지
