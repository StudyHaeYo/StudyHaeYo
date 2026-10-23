# 데이터 모델 (프론트 ↔ 백엔드 계약)

기준 시점: 2026-10-20 (`main` b387501 기준). DB 설계는 PR #11의 `docs/DB_SCHEMA_DRAFT.md`에서 합의 중이고, 합의되기 전까지 이 문서는 지금 코드(메모리 저장)를 설명한다.

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
| Home/학습 분석 통계 계산 | `lib/study-stats.ts` |
| 파일 첨부(저장 지점) | `lib/attachments.ts` |
| 그림 블록 | `lib/drawing.ts` |

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
| blocks | Block[] | 빈 페이지 본문. 블록 종류는 아래 "블록" 참고 |
| note | StudyNoteContent (선택) | 학습 노트 본문. 아래 참고 |
| tags | string[] | |
| studyRecords | PageStudyRecord[] | 이 페이지의 학습 기록 |
| status | `시작 전｜학습 중｜복습 필요｜완료` (선택) | **사용자가 직접 고른 값.** 없으면 파생 |
| understanding | number 1~5 (선택) | **사용자가 직접 고른 값.** 없으면 최신 기록에서 파생 |
| studyEnabled | boolean (선택) | 학습 기능이 "선택"인 템플릿에서 사용자가 켰는지 |

### StudyNoteContent (학습 노트 본문)
- `learned`: Block[] — 오늘 배운 내용. 학습 노트의 첨부와 그림 블록은 여기에만 들어간다
- `concepts`: `{id, text}[]` — 핵심 개념. `"용어: 설명"` 형태로 쓰면 복습 카드의 앞면/뒷면으로 나뉜다(`splitConcept`)
- `confusions`: `{id, text, resolved}[]` — 헷갈린 점. 항목별 해결 여부

### 블록 (`Block = TextBlock | AttachmentBlock | DrawingBlock | DividerBlock | PageLinkBlock`)
**글 블록**: `{id, type, text, checked?, body?, open?}`. `type`은 h1｜h2｜h3｜p｜li｜ol｜todo｜toggle｜quote｜callout｜code
- `ol`(번호 목록): 번호는 저장하지 않고 바로 위로 이어진 `ol` 블록 수로 매긴다
- `todo`(체크 목록): `checked`. 홈의 "오늘의 체크리스트"(`todos` 테이블)와는 따로다
- `toggle`(토글): `text`가 제목, `body`가 접히는 내용(여러 줄 글), `open`이 펼침 상태. 검색과 AI는 `body`도 읽는다(`textBlockWords`)
- `quote`(인용), `callout`(💡 강조 박스)은 모양만 다르다
- 다른 종류로 바꾸면 그 종류가 안 쓰는 칸은 지운다(`withType`). 토글을 본문으로 되돌리면 `body`는 바로 아래 본문 블록이 된다

**구분선** (`type: "divider"`): `{id, type}`

**페이지 링크** (`type: "pagelink"`): `{id, type, pageId}`. 제목은 저장하지 않고 열 때마다 그 페이지에서 읽는다(이름을 바꾸면 따라 바뀜). 대상 페이지를 지우면 "삭제된 페이지"로 보인다

**첨부 블록** (`type: "image"｜"file"`): `{id, type, name, mime, size, url, path?, annotations?}`. `annotations`는 PDF 위 필기로, 쪽 번호(1부터, 문자열 키)마다 그림 블록과 같은 획 배열을 둔다. 좌표도 그림 블록처럼 쪽 너비 기준 비율이라 화면 크기가 달라도 같은 자리에 그려진다. 필기가 없는 쪽은 키를 두지 않는다. `path`는 Supabase Storage `attachments` 버킷 안의 위치(`<사용자 id>/<파일 id>`)이고, 있으면 화면은 `url` 대신 `path`로 1시간짜리 임시 주소(signed URL)를 받아 연다. `url`은 올린 탭에서만 쓰는 `blob:` 주소라 다른 탭이나 새로고침 뒤에는 쓰지 않는다
- `url`은 지금 브라우저 임시 주소(`URL.createObjectURL`)라 새로고침하면 사라진다. 파일을 저장하고 url을 만드는 곳은 `lib/attachments.ts`의 `storeAttachmentFile` 하나뿐이다.

**그림 블록** (`type: "drawing"`): `{id, type: "drawing", strokes, height}`
- `height`는 px(처음 320, "아래로 늘리기"마다 +120).
- 획(stroke) = `{tool: "pen"｜"highlighter", color, width, points}`. `points`는 `[x, y]` 배열이고, **x와 y 모두 블록 너비를 1로 본 비율**이다. 화면 너비가 달라도 그림 모양이 유지되게 하려는 것이다. `width`는 화면 px라서 확대·축소해도 선 굵기는 그대로다.
- 비트맵이 아닌 좌표로 저장한다(D-16). 되돌리기/다시 실행 기록은 블록이 화면에 있는 동안에만 유지되고 저장하지 않는다.

**공통**: 첨부와 그림은 텍스트가 아니므로 AI 도구용 본문 텍스트(`blocksPlainText`)에서 빠진다. 페이지를 복제하면 그림은 획 데이터까지 깊은 복사하고(`cloneBlock`), 첨부는 블록만 복사해서 **복제본이 원본과 같은 파일을 가리킨다.**

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

### Todo (오늘의 체크리스트, `lib/todos.ts`, 테이블 `todos`)
`{id, title, dueOn, doneAt, position}`
- `dueOn`은 할 날짜(로컬 날짜 문자열), `doneAt`은 완료 시각(ms, 안 했으면 null)
- 페이지나 계획과 연결하지 않는다
- 테이블 정의와 RLS는 `supabase/migrations/20261021_todos.sql`

### 세션 (브라우저 전용, localStorage `studyhaeyo:study-session`)
- `startedAt`, `segments[{pageId,start,end}]`, `openSegment`, `lastActiveAt`, `log: FinishedSession[]`
- `FinishedSession = {id, startedAt, endedAt, segments, autoEnded?}`

### 템플릿 (코드로 정의, DB에 저장하지 않는다)
`{id, name, tagline, treeIcon, bodyTemplate, reviewTemplate?, studyMode, createContent}`
- `studyMode`는 `"locked-on"`(학습 기능이 항상 켜져 있고 끌 수 없음) 또는 `"optional"`(페이지마다 켜고 끔)
- `studyMode`는 템플릿에서 정해지므로 페이지에 따로 저장하지 않는다.

### 없는 것
User는 Supabase Auth 사용자다. 모든 데이터 행은 `user_id`로 소유자를 가리키고, 앱은 `user_id`를 `auth.getUser()`로 검증한 값으로만 채운다. `profiles`는 아직 화면에서 쓰지 않는다. 사이드바와 설정 화면의 이름·이메일은 `lib/auth.ts`의 `useCurrentUser`(가입 때 넣은 `display_name`, 없으면 이메일 앞부분)에서 온다. 로그아웃(`signOut`)은 대기 중인 저장을 먼저 끝낸다(`settleWrites`).

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

**새 기록이 수동값을 지운다**: 학습 기록을 **추가**하면(직접 추가, 복습 완료 모두) 그 페이지의 수동 `status`와 `understanding`을 지우고 다시 파생값으로 돌아간다. 새 기록이 가장 최근의 학습 상태를 나타내기 때문이다. 기록을 수정하거나 삭제할 때는 수동값을 건드리지 않는다.

---

## 3. 동작 규칙

**R1. 템플릿과 학습 기능**
학습 기능이 켜진 모든 페이지는 템플릿과 무관하게 같은 속성 패널 + 학습 기록 + AI 학습 도구를 가진다. "locked-on" 템플릿은 항상 켜져 있다. "optional" 템플릿은 `studyEnabled`로 결정하고, 이 값이 없는 옛 페이지는 기록이 하나라도 있으면 켜진 것으로 본다. 학습 기능을 꺼도 본문과 기록 데이터는 지우지 않는다.

**R2. Home 복습 후보** (`reviewCandidates`)
- 후보는 "locked-on" 템플릿의 페이지만. 빈 페이지는 학습 기능이 켜져 있어도 제외
- status가 "완료"면 제외. status가 "복습 필요"이거나 `nextReviewAt <= 내일`이면 포함
- 정렬: `nextReviewAt` 오름차순 → 이해도 오름차순 → 미해결 헷갈린 점이 많은 순
- 날짜 표시: "N일 지남"/"오늘"/"내일"(`dueLabel`)

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
- 뽀모도로(`lib/pomodoro.ts`): 홈에서 켜면 세션도 시작된다. 25분 집중 → 5분 휴식, 집중 4번마다 15분 휴식을 자동으로 넘긴다. **휴식 중에는 구간을 기록하지 않는다**(노트 화면에 있어도). 세션을 끝내면 뽀모도로도 꺼진다. 세션처럼 브라우저에만 저장하고 DB에는 없다

**R5. 세션 시간 중복 집계 방지** (`unrecordedSessionMinutes`)
어떤 세션에서 어떤 페이지의 구간 시간은, 그 세션의 시작~종료(진행 중이면 지금) 사이에 **그 페이지에 만들어진 학습 기록이 하나라도 있으면** 합계에서 제외한다. 기록을 만든 경로(요약 모달, 복습 완료, 직접 추가)는 상관없다. 기록이 없는 페이지의 구간만 "기록되지 않은 세션 시간"으로 더한다.
- 사용자가 미리 채워진 시간을 줄여서 저장하면 그 값이 최종값이다(예: 45분 → 10분이면 10분)
- 기록의 생성 시각은 `createdAt`, 없으면 id 끝의 `-r-<ms>`에서 복원한다. 둘 다 없는 기록(시드)은 어떤 세션에도 속하지 않는다
- 지금 없는 페이지(삭제했거나 새로고침으로 사라진 페이지)의 구간은 더하지 않는다. 그 페이지의 기록도 이미 합계에서 빠졌기 때문이다

**R6. 학습 분석 합계**
- 총 학습 시간 = **모든 페이지**(템플릿 무관)의 기록 `durationMinutes` 합 + 기록되지 않은 세션 시간
- 학습 기록 수, 평균 이해도도 모든 페이지의 기록 기준
- 즉 빈 페이지의 기록은 합계에는 들어가지만 Home 복습 후보에서는 빠진다

**R7. 트리**
- 깊이 제한이 없다. 그룹은 그룹/페이지를 담고, 페이지도 하위 페이지를 담는다
- 학습 기록은 트리 노드가 아니다
- 자기 자신이나 자기 하위로는 이동할 수 없다(`canMoveNode`)
- 그룹의 종류는 만들 때 고르고 나중에 바꿀 수 있다. 과목을 폴더로 바꾸려면 그 과목을 대상으로 한 학습 계획이 없어야 한다(`plansTargetingSubject`)
- 페이지/그룹을 삭제하면 그 아래의 페이지와 그룹이 모두 함께 삭제된다. 그룹 이름 변경과 삭제는 사이드바 그룹 ⋯ 메뉴에서 한다(`renameGroup`, `deleteGroup`). 삭제하는 항목이나 그 하위를 대상으로 한 학습 계획도 함께 삭제되고, 확인 창에 그 개수를 보여준다(`plansInSubtree`). 과목을 폴더로 바꾸는 것은 계획이 있으면 여전히 막는다(계획이 대상을 잃기 때문)
- 복제하면 원본 바로 뒤에 `(사본)`이 붙은 페이지가 생긴다. 본문과 노트는 복사하고 학습 기록은 복사하지 않는다(같은 학습 시간이 두 번 집계되지 않게)

**R8. 렌더링 (hydration)**
서버 스냅샷은 항상 시드/idle 상태이고, 브라우저 전용 값(오늘 날짜, 세션)은 마운트 이후에만 읽는다. 데이터 로딩 방식을 바꿀 때도 서버 렌더와 클라이언트 첫 렌더 결과가 같아야 한다.
서버 컴포넌트(`page.tsx`, `layout.tsx` 등)는 `lib/workspace.ts`, `lib/plans.ts`, `lib/create-store.ts`, `lib/study-stats.ts`처럼 클라이언트 저장소에 닿는 파일을 직접·간접으로 import하지 않는다. 서버와 클라이언트가 같이 쓰는 상수는 `lib/goals.ts`처럼 import가 없는 파일에 둔다. (이 규칙을 어겨서 2026-10-17 배포가 실패했다.)

**R9. 첨부와 그림 블록 넣기**
- 페이지 헤더 ⋯ 메뉴의 "파일 첨부"와 "그림 추가"로 넣는다. 첨부는 본문으로 드래그 앤 드롭, 이미지 붙여넣기도 된다. 사이드바 메뉴에는 없고, 복습 모드에서는 두 항목이 숨겨진다
- 첨부는 파일당 10MB 이하(`MAX_ATTACHMENT_BYTES`). PNG/JPEG/GIF/WebP는 본문에 이미지로 보이고, PDF는 파일 카드 + 미리보기, 그 외 형식은 열기/다운로드만 된다
- 저장(`lib/attachments.ts`): 로그인 상태면 Storage에 올린 뒤 블록을 넣는다(올리는 중 알림). 올리기에 실패하거나 로그인 정보가 없으면 그 탭에서만 보이는 첨부로 넣고 "새로고침하면 사라져요"라고 알린다. 파일은 덮어쓰지 않고 매번 새 id로 올린다
- `path`가 없고 다른 탭에서 만든 `blob:` 주소인 옛 첨부, 또는 Storage에서 열 수 없는 첨부는 "저장되지 않은 파일" 카드로 보이고 지우기만 된다
- 다운로드는 원래 파일 이름으로 받도록 다운로드용 임시 주소를 따로 받는다(브라우저가 다른 도메인 링크의 `download` 속성을 무시해서)
- PDF 필기: PDF 첨부 카드의 [보기·필기]로 전체 화면을 연다. 쪽마다 펜·형광펜·지우개를 쓰고, 필기는 바로 그 첨부 블록의 `annotations`에 저장된다(본문 저장과 같은 경로). 되돌리기는 쪽을 넘나들며 순서대로, "이 쪽 필기 지우기"는 화면 가운데에 걸친 쪽. 터치 화면은 스크롤할 수 있게 이동(손) 도구로 시작한다. PDF 파일 자체는 바꾸지 않는다
- 위치: 마지막으로 클릭한 줄 바로 뒤, 없으면 본문 끝. 학습 노트는 항상 "오늘 배운 내용" 영역에 들어간다(핵심 개념, 헷갈린 점은 글 항목이라 넣을 수 없다)
- AI 요약/문제 생성은 글 블록을 맥락으로 쓰고, 사용자가 고른 PDF 첨부(Storage에 저장된 것, `path`)는 서버가 원본을 받아 함께 보낸다(D-22). 그림·이미지·PDF 위 필기는 보내지 않는다

---

**R11. Home "오늘 할 일"** (`components/learning-os/today-agenda.tsx`)
- 한 카드에 세 묶음: 복습할 노트(R2 후보 중 위에서 3개, 첫 번째는 바로 "복습하기"), 진행 중인 계획, 체크리스트(R10)
- 진행 중인 계획(`activePlans`): 시작일 ≤ 오늘 ≤ 종료일인 계획, 종료일이 가까운 순. 진도는 저장하지 않고, 계획 대상(전체/과목 하위 전체/페이지와 그 하위)의 기록 중 시작일~오늘 날짜의 `durationMinutes` 합으로 보여준다. 남은 일수는 오늘부터 종료일까지
- 학습 계획 화면과 과목 화면은 같은 계산(`planProgress`, `groupPlans`)으로 계획을 진행 중 / 예정 / 끝난 계획으로 나눈다. 끝난 계획의 학습 시간은 시작일~종료일까지만 센다. 기간 막대는 지난 날수/전체 날수(학습 시간 목표는 자유 문장이라 계산하지 않는다)
- 계획의 목표(`goal`)는 글이라 진도 비율은 계산하지 않는다
- 제목 아래 한 줄 요약(`TodaySummary`): 오늘 또는 지난 복습일의 노트 수, 오늘 마감되는 계획 수, 오늘 안 끝낸 할 일 수
- 이번 주 학습: 월요일~오늘 기록 시간 합과 주간 목표(`WEEKLY_GOAL_MINUTES`), 요일별 막대, 목표까지 남은 시간을 오늘 포함 남은 날수로 나눈 하루 분량(`perDayToGoal`)

**R12. 학습 잔디와 연속 학습일** (`studyCalendar`, `studyStreak`)
- 잔디: 최근 12주, 월요일 시작 열. 칸 색은 그날 모든 기록의 `durationMinutes` 합(0, 30분 미만, 60분 미만, 120분 미만, 그 이상)
- 연속 학습일: 기록이 있는 날이 끊기지 않고 이어진 일수. 오늘 기록이 아직 없으면 어제까지로 센다(오늘 안에 기록하면 이어짐). 최고 기록도 같은 방식
- 세션 타이머의 기록 전 시간은 넣지 않는다(기록만)

**R10. 오늘의 체크리스트** (`todayChecklist`)
- 오늘 목록 = `dueOn`이 오늘인 할 일 + 그 전 날짜인데 아직 안 끝낸 할 일(넘어온 것, "이월" 표시) + 오늘 끝낸 할 일
- 전날 이전에 끝낸 할 일은 목록에서 빠진다(DB에는 남는다)
- 순서: 안 끝낸 것 먼저, 그다음 `position`
- 새 할 일은 오늘 날짜로 만든다. 이름은 눌러서 바꾸고, ✕로 지운다
- 예외: 학습 기록을 추가한 직후 "다음 복습은 ○월 ○일" 안내에서 [그날 체크리스트에 추가]를 누르면 `dueOn`이 그 복습일인 "<페이지 제목> 복습"을 만든다. 그날부터 목록에 보인다
- `todos` 테이블을 읽지 못하면(아직 안 만들었으면) 체크리스트만 "준비 중"으로 보이고 나머지 화면은 그대로 동작한다

**R13. 학습 분석의 주별 추세와 한눈에 보기** (`weeklyTrend`, `studyInsights`)
- 주별 추세: 이번 주 포함 최근 8주(월요일 시작), 주마다 기록의 `durationMinutes` 합. 평균은 이번 주를 뺀 7주로 낸다(진행 중인 주가 평균을 끌어내리지 않게)
- 한눈에 보기는 세 문장까지: ① 이번 주 vs 지난주 **같은 요일까지**의 학습 시간(주 초반에 항상 "줄었다"가 나오지 않게) ② 최근 2주 vs 그 전 2주의 평균 이해도(양쪽 다 기록이 있을 때만) ③ 이해도가 가장 낮은 과목(`subjectMastery` 기준)
- 비교할 데이터가 없으면 그 문장은 빼고, 다 없으면 기록이 쌓이면 알려 준다는 안내를 띄운다

---

## 4. 프론트가 의존하는 함수 (DB 전환 시 교체 지점)

| 파일 | 함수 |
|---|---|
| `lib/workspace.ts` | `useWorkspace()`, `createPage`, `updatePage`, `renamePage`, `duplicatePage`, `deletePage`, `moveNode`, `canMoveNode`, `addGroup`, `renameGroup`, `deleteGroup`, `setGroupKind` |
| `lib/plans.ts` | `usePlans()`, `addPlan`, `removePlan` |
| `lib/study-session.ts` | 세션 함수들. localStorage 기반이라 서버로 옮길 때 별도 설계가 필요하다 |
| `lib/attachments.ts` | `storeAttachmentFile`. 파일을 저장하고 url을 돌려주는 유일한 지점. 서버 저장을 붙일 때 이 함수를 교체한다 |

DB를 붙일 때는 이 시그니처를 유지하는 어댑터를 우선 고려하면 UI 수정이 최소화된다.
단 `updatePage(id, update)`는 "기존 페이지를 받아 새 페이지를 돌려주는 함수"를 받는다. 서버에서는 "바뀐 필드만 보내는 PATCH"가 자연스러우므로, 이 부분은 프론트 변경이 필요할 수 있어 협의한다.

---

## 5. 알려진 불일치와 주의

1. **페이지, 기록, 학습 계획은 Supabase에 저장한다.** `createStore`는 화면 캐시이고, 접근은 `lib/workspace.ts`/`lib/plans.ts` 함수 뒤의 `lib/db/`에만 있다.
   - 매핑: 그룹·페이지 → `workspace_nodes`(`kind` folder/subject/page, 페이지 전용 컬럼은 그룹에서 null), 기록 → `study_records`, 계획 → `learning_plans`(`target_scope` + `target_node_id`). 행 ↔ 타입 변환은 `lib/db/rows.ts`
   - 불러오기: 로그인 후 마운트 시점에 한 번(`lib/db/sync.ts`). 캐시의 서버 스냅샷은 빈 상태, 상태는 "loading"이라 hydration이 맞는다(R8). 로그아웃·계정 전환 시 캐시와 대기 중 쓰기를 비운다
   - 쓰기: 캐시를 먼저 바꾸고 쓰기를 순서대로 하나씩 실행한다(`lib/db/queue.ts`). 제목·본문은 0.6초 디바운스. 실패하거나 0행이 바뀌면(RLS) 토스트 후 DB에서 다시 불러온다
   - 형제 순서: `workspace_nodes.position`(형제 안의 0부터 index). 불러올 때 `position, created_at` 순으로 `order`를 만든다. 트리가 바뀌면(생성·이동·복제·삭제) 저장된 값이 화면의 형제 index와 다른 노드만 고치므로, 빈 번호나 겹친 값은 그때 0부터 다시 매겨진다
   - 삭제: 루트 행만 지운다(`parent_id`, `study_records.page_id`는 cascade). `learning_plans.target_node_id`가 `ON DELETE RESTRICT`라서, 하위 트리를 대상으로 한 계획을 먼저 지우고(`removePlans`) 그다음 노드를 지운다. 쓰기는 호출 순서대로 실행된다(R7)
   - `study_records.understanding`이 null인 행은 3으로 읽는다(앱은 항상 1~5를 쓴다)
   - 예시 데이터: 워크스페이스가 완전히 비었을 때만 홈 안내 카드에 "예시 데이터 가져오기"가 보인다(`importExampleData`). 시드(`lib/study-tree.ts`, `lib/study-pages.ts`, `lib/plans.ts`의 `examplePlans`)를 새 uuid로 그 계정에 저장한다. 저장 직전에 그 계정의 노드가 DB에 있는지 다시 확인해 중복을 막고, 기존 데이터는 건드리지 않는다. 시드의 날짜(기록, 페이지 생성일, 계획 기간)는 모두 같은 일수만큼 옮겨서 가장 최근 기록이 가져온 날의 어제가 되게 한다. `createdAt`은 공부한 날 정오다. 노드는 트리 깊이별로 나눠 부모부터 insert한다
   - 불러온 그룹·페이지 배열은 사이드바(깊이 우선) 순서로 맞춘다. 위젯이 배열 순서대로 과목과 페이지를 나열하기 때문이다
   - 권한: 네 테이블 모두 `authenticated` 역할에 select/insert/update/delete 정책이 있고, 조건은 `auth.uid() = user_id`(`profiles`는 `= id`)다. 계획의 대상 노드 소유자는 `learning_plans`의 `check_learning_plan_owner` 트리거가 검사한다(단일 FK 보완)
   - 세션 타이머는 여전히 브라우저 전용이다. 체크리스트는 `todos` 테이블에 저장한다(R10). 첨부 파일은 Storage `attachments` 버킷에 저장한다(R9, `supabase/migrations/20261023_attachments_storage.sql`)
2. **정적 더미 위젯은 없다.** Home의 나의 학습 상태/오늘의 기록/이번 주 학습 통계, 학습 분석의 과목별 학습 상태/취약 학습 영역/복습 예정/최근 학습 활동은 모두 `lib/study-stats.ts`가 워크스페이스 페이지의 `studyRecords`에서 계산한다.
   - 과목: 페이지의 가장 가까운 상위 과목(`nearestSubject`), 없으면 "과목 없음"(일반 폴더 이름을 대신 쓰지 않는다)
   - 나의 학습 상태 / 과목별 학습 상태: 과목별 기록 `understanding` 평균 ÷ 5 × 100 (기록 없는 과목은 숨김)
   - 오늘의 기록: `date`가 오늘인 기록, 최신순(`createdAt`, 없으면 id의 시각, 그것도 없으면 `date`)
   - 이번 주 학습 통계: 월요일~오늘의 `date` 기준 과목별 `durationMinutes` 합. 목표는 `WEEKLY_GOAL_MINUTES`(600분, 설정 화면과 같은 상수)
   - 취약 학습 영역: 페이지 이해도(R1) ≤ 2 이거나 미해결 헷갈린 점 ≥ 1. 미해결 많은 순 → 이해도 낮은 순, 최대 5개
   - 복습 예정: R2와 같은 페이지 범위(locked-on 템플릿), 상태가 완료가 아니고 다음 복습일이 있는 페이지, 날짜순 최대 5개. 날짜 옆에 "3일 지남"/"오늘"/"내일"/"5일 후"(`dueLabel`, Home 복습 목록과 같은 표시)
   - 최근 학습 활동: 전체 기록 최신순 5개
   - `lib/learning-os.ts`의 고정값과 `dummy-data.ts`의 records/weeklyStats는 더 이상 화면에서 쓰지 않는다(파일은 남겨둠).
3. **`StudyRecord`가 두 가지다.** `lib/types.ts`의 `StudyRecord`(title/category/type...)는 옛 형태로 `components/record-card.tsx`에만 남아 있고(Home과 과목 화면은 더 이상 쓰지 않음), 실제 학습 기록은 `lib/study-pages.ts`의 `PageStudyRecord`다. DB는 `PageStudyRecord` 기준으로 설계한다.
4. `/subject/[id]`는 워크스페이스의 `kind: "subject"` 그룹에서 과목을 찾는다(`page.tsx`는 id만 넘기고 `components/subject/subject-view.tsx`가 찾음). 요약/페이지 목록은 `subjectSummary`/`subjectPageRows`(R6: 하위 모든 페이지·템플릿 무관)로 계산하고, 옛 주간 목표 대신 이 과목을 target으로 한 `LearningPlan`을 보여준다. 없는 id는 404가 아니라 "과목을 찾을 수 없어요" 안내를 보여준다(데이터를 불러오는 중에는 로딩 표시).
   - 남은 주의: `findSubject`, `weekly-goals.tsx`, `record-card.tsx`는 더 이상 이 화면에서 쓰지 않는다(파일은 남겨둠).
5. 시드/레거시: `lib/study-tree.ts`는 초기 그룹 시드용, `lib/dummy-data.ts`의 `categories`는 일부 화면에서 아직 쓰인다. 옛 더미 화면 `app/ai`, `app/notes`, `app/study`는 지웠다. `/plan`은 학습 계획 목록만 남기고 사이드바에 연결했다.
6. 형식 불일치: 페이지 `createdAt`은 날짜 문자열, 기록 `createdAt`은 ms 숫자. 날짜는 타임존 없는 로컬 날짜 문자열이다.
7. 페이지·그룹·기록·계획 id는 클라이언트가 `crypto.randomUUID()`로 만든다(DB 컬럼에 기본값 없음). 같은 날짜 기록의 정렬 동률은 `createdAt`으로 깬다. 시드의 `ds-1` 같은 id와 옛 `<pageId>-r-<ms>` 기록 id는 DB에 없다.
8. `app/page/new/page.tsx`의 옛 경로 리다이렉트는 쿼리 값을 인코딩하지 않는다(`app/record/[id]`는 수정됨).
9. 세션 로그는 localStorage에만 쌓이고 정리 기준이 없다.
10. 첨부를 복제하면 복제본이 원본과 같은 파일을 가리킨다. 그래서 블록이나 페이지를 지워도 Storage의 파일은 지우지 않는다(다른 블록이 쓰고 있을 수 있다). 아무 블록도 가리키지 않는 파일 정리는 아직 없다
11. `next.config.mjs`의 `typescript.ignoreBuildErrors: true` 때문에 `pnpm run build`는 타입 오류를 검사하지 않는다. 타입은 `npx tsc --noEmit`으로 따로 확인한다.

---

## 6. 아직 정하지 않은 것

신규 사용자는 빈 상태로 시작하고, 원하면 홈에서 예시 데이터를 가져온다(인증은 D-18로 결정됨).

- 세션/구간을 서버에 저장할지 (R5의 중복 집계를 서버에서 하려면 필요하다)
- 날짜/타임존 처리
- 파생값(status, 다음 복습일 등)을 저장할지 계산할지
- 파일 저장소, 복제 시 파일을 공유할지 복사할지, 파일을 언제 지울지, 서버 쪽 형식/크기 검증
- 퀴즈: 기존 OX 채점 작업(`v0/quiz-ox-grading`)은 main에 들어가지 않았고 폐기한다. 새로 설계하며 방향은 아직 정하지 않았다
- `workspace_nodes.updated_at`을 갱신할지(기본값 `now()`만 있고 갱신 트리거가 없어 생성 시각에 머문다)
