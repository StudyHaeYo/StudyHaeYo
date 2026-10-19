# Supabase(Postgres) 스키마 초안

상태: **합의용 초안** (2026-10-19, `main` dbfca88 기준). 구현 전에 이 PR에서 재윤·준혁이 합의한다.
합의된 항목은 `DECISIONS.md`에 번호를 붙여 옮기고, 이 문서는 마이그레이션 SQL이 생기면 지운다.

기준 문서는 `DATA_MODEL.md`지만 **코드와 다른 곳은 코드를 따랐다.** 다른 점은 맨 아래 "문서와 코드의 차이"에 모았다.
SQL은 설계를 정확히 전달하기 위한 초안이고 아직 마이그레이션 파일로 만들지 않았다.

---

## 0. 한눈에 보기

| 테이블 | 내용 | 원본 타입 |
|---|---|---|
| `profiles` | 사용자별 설정(타임존). `auth.users`와 1:1 | 없음(User 엔티티가 아직 없다) |
| `nodes` | 트리 노드 전부: 폴더·과목·페이지. 부모, 형제 순서, 제목 | `WorkspaceGroup` + `StudyPage`의 트리 부분 |
| `pages` | 페이지 전용 속성과 본문(`blocks`, `note`는 jsonb) | `StudyPage` |
| `study_records` | 학습 기록 | `PageStudyRecord` |
| `learning_plans` | 학습 계획 | `LearningPlan` |
| `todos` | 할 일(Home "오늘의 체크리스트") | `ChecklistItem` |
| `study_sessions`, `session_segments` | 끝난 학습 세션과 페이지별 구간 | `FinishedSession`, `SessionSegment` |
| `attachments` + Storage 버킷 `attachments` | 첨부 파일 메타데이터와 실제 파일 | `AttachmentBlock` |

```
auth.users ─1:1─ profiles
     │
     └─< nodes ──(parent_id, 자기참조, ON DELETE CASCADE)──┐
           │  └────────────────────────────────────────────┘
           ├─1:1─ pages ─< study_records
           │        ├─< session_segments >─ study_sessions
           │        └─ (jsonb 안의 attachmentId) ─ attachments ─ storage.objects
           └─< learning_plans (target_id, scope가 subject/page일 때)
todos (독립)
```

공통 규칙
- **모든 테이블에 `user_id uuid not null default auth.uid()`** 를 둔다. 클라이언트는 `user_id`를 보내지 않아도 된다.
- 모든 FK는 `(user_id, 대상_id)` 복합 FK로 건다. Postgres의 FK 검사는 RLS를 거치지 않기 때문에, 단일 FK면 남의 노드 id를 알 경우 그 밑에 내 페이지를 붙일 수 있다. 복합 FK면 "같은 사용자의 행"만 참조할 수 있다. 이를 위해 참조되는 테이블은 `unique (user_id, id)`를 가진다.
- 시각은 `timestamptz`, "공부한 날"처럼 사용자가 고른 달력 날짜는 `date`.

---

## 1. id 발급: 클라이언트가 uuid를 만든다 (추천)

- 컬럼 타입은 `uuid`, 값은 클라이언트가 `crypto.randomUUID()`로 만든다. DB 기본값(`gen_random_uuid()`)은 예비용.
- **이유**: `createPage()`와 `addGroup()`은 지금 id를 동기로 돌려주고 UI가 바로 그 id로 이동한다. 클라이언트가 id를 만들면 이 시그니처를 그대로 두고 낙관적 업데이트(먼저 화면 반영, 나중에 저장)를 할 수 있다. DB가 발급하면 저장 응답을 기다려야 해서 반환형이 `Promise`로 바뀐다.
- 바꿔야 할 곳: `lib/workspace.ts`의 `uid()`, `lib/plans.ts`의 `plan-…`, 그리고 기록 id를 직접 만드는 두 곳(`components/study-page/add-record-form.tsx:39`, `study-page-view.tsx:91`). 컴포넌트가 형식을 알 필요가 없도록 `lib`에 `newRecordId()`를 두고 그걸 부르게 한다.
- 블록/핵심 개념/헷갈린 점의 id(`b-…`, `c-…`, `q-…`)는 jsonb 안에서 페이지 단위로만 유일하면 되므로 그대로 둔다.
- 기록 id에서 생성 시각을 복원하는 로직(`recordCreatedAt`의 `-r-<ms>`)은 `created_at` 컬럼이 항상 있으므로 필요 없어진다.
- 시드 데이터(`ds-1` 등)는 DB로 옮기지 않는다. 신규 사용자 예시 데이터가 필요하면 가입 시 새 uuid로 넣는 함수를 따로 만든다(→ 미정 항목).

---

## 2. 테이블

### 2.1 profiles
```sql
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  timezone   text not null default 'Asia/Seoul',  -- 서버에서 "오늘"을 계산해야 할 때 쓴다
  created_at timestamptz not null default now()
);
```
User 모델은 아직 미정이라 최소한만 둔다. 지금은 화면이 브라우저 날짜만 쓰므로 `timezone`은 서버 집계/알림이 생길 때를 위한 것이다.

### 2.2 nodes — 트리(폴더·과목·페이지)
```sql
create table public.nodes (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id  uuid,                                   -- null = 최상위. 그룹이든 페이지든 부모가 될 수 있다
  kind       text not null check (kind in ('folder', 'subject', 'page')),
  title      text not null default '',               -- 그룹의 name, 페이지의 title
  position   text collate "C" not null,              -- 형제 순서(분수 인덱스, 3장)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, parent_id) references public.nodes (user_id, id) on delete cascade,
  check (parent_id is distinct from id)
);
create index nodes_children_idx on public.nodes (user_id, parent_id, position);
```
- **그룹과 페이지를 한 테이블에 둔 이유**: 형제 목록에 그룹과 페이지가 섞이고(`childNodes`), 부모도 둘 중 아무거나다(D-03). 테이블을 나누면 부모 FK가 둘(또는 FK 없는 다형 컬럼)이 되고 형제 순서도 두 테이블에 걸친다. 한 테이블이면 이동은 행 하나 `update`, 하위 삭제(R7)는 `on delete cascade` 한 줄로 끝난다.
- 자기 하위로 이동 금지(R7, `canMoveNode`)는 클라이언트 검사에 더해 DB 트리거로 막는다.
```sql
create function public.prevent_node_cycle() returns trigger language plpgsql as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.nodes where id = new.parent_id
      union all
      select n.id, n.parent_id from public.nodes n join up on n.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'node cannot move into its own subtree';
  end if;
  return new;
end $$;

create trigger nodes_no_cycle before update of parent_id on public.nodes
  for each row execute function public.prevent_node_cycle();
```
- `kind`는 지금 UI에서 바뀌지 않는다. `kind = 'page'`인 노드에는 `pages` 행이 반드시 하나 있어야 하는데, 이는 페이지 생성을 RPC 하나(`create_page`)로 묶어서 지킨다(5장).

### 2.3 pages — 페이지 속성과 본문
```sql
create table public.pages (
  node_id       uuid primary key,
  user_id       uuid not null default auth.uid(),
  template_id   text not null,                       -- 'study-note' | 'blank'. 템플릿 정의는 코드(D-04)라 check 없음
  created_on    date not null,                       -- StudyPage.createdAt("YYYY-MM-DD", 사용자 로컬 날짜)
  study_type    text check (study_type in ('강의', '문제풀이', '복습', '정리')),
  status        text check (status in ('시작 전', '학습 중', '복습 필요', '완료')),  -- 수동값만. null이면 파생
  understanding smallint check (understanding between 1 and 5),                     -- 수동값만. null이면 파생
  study_enabled boolean,                             -- null = 옛 페이지 규칙(R1: 기록이 있으면 켜짐)
  tags          text[] not null default '{}',
  blocks        jsonb not null default '[]',         -- 빈 페이지 본문 Block[]
  note          jsonb,                               -- 학습 노트 본문 StudyNoteContent, 없으면 null
  updated_at    timestamptz not null default now(),
  unique (user_id, node_id),
  foreign key (user_id, node_id) references public.nodes (user_id, id) on delete cascade
);
create index pages_user_idx on public.pages (user_id);
```
- **본문은 jsonb 한 덩어리로 둔다(블록별 행으로 쪼개지 않는다).** 지금 편집기는 블록 배열 전체를 `onChangeBlocks(blocks)`로 넘기고, 블록을 페이지 밖에서 조회하는 기능도 없다. 블록 행 테이블은 순서·동시편집 문제만 늘린다. 여러 기기 동시편집이 요구되면 그때 다시 본다.
- `title`은 `nodes`에 있다(트리에서 필요). 어댑터가 `StudyPage`를 만들 때 합친다.
- status/understanding 값은 코드의 한글 값을 그대로 저장한다. 어댑터에 변환 계층을 두지 않기 위해서다(영문 코드로 바꿀지는 미정 항목).
- 크기: 그림 블록의 획 좌표 때문에 본문이 수백 KB가 될 수 있다. 1단계에서는 그대로 두고, 저장 빈도는 디바운스(4장)로 줄인다. 문제가 되면 그림 블록만 별도 테이블로 빼는 것을 검토한다.

### 2.4 study_records — 학습 기록
```sql
create table public.study_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid(),
  page_id          uuid not null,
  studied_on       date not null,                    -- PageStudyRecord.date (공부한 날)
  created_at       timestamptz not null default now(),  -- R5 중복 집계 판단용. 수정해도 유지, 복제 시 원본 값 유지(R7)
  duration_minutes integer not null check (duration_minutes >= 0),
  understanding    smallint not null check (understanding between 1 and 5),
  study_content    text not null default '',
  difficulties     text not null default '',
  next_steps       text not null default '',
  tags             text[] not null default '{}',
  updated_at       timestamptz not null default now(),
  foreign key (user_id, page_id) references public.pages (user_id, node_id) on delete cascade
);
create index study_records_page_idx on public.study_records (page_id, studied_on desc, created_at desc);
create index study_records_user_day_idx on public.study_records (user_id, studied_on);
create index study_records_user_created_idx on public.study_records (user_id, created_at);
```
- 기록은 트리 노드가 아니라 페이지에 딸린 데이터다(D-01). 그래서 `nodes`가 아니라 `pages`를 참조한다.
- `created_at`이 이제 항상 있으므로 옛 기록의 "createdAt 없음" 분기가 사라진다.
- 정렬 주의: `sortRecordsNewestFirst`는 같은 날짜면 `id` 내림차순인데, uuid는 시간 순서가 아니다. 동률 기준을 `createdAt`으로 바꿔야 한다(`lib/study-pages.ts` 내부 변경, 시그니처 영향 없음).

### 2.5 learning_plans — 학습 계획
```sql
create table public.learning_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  title      text not null,
  scope      text not null check (scope in ('all', 'subject', 'page')),
  target_id  uuid,                                   -- subject면 과목 노드, page면 페이지 노드
  start_date date not null,
  end_date   date not null,
  goal       text not null default '',
  created_at timestamptz not null default now(),
  check ((scope = 'all') = (target_id is null)),
  check (end_date >= start_date),                    -- 폼이 이미 end < start를 start로 맞춘다
  foreign key (user_id, target_id) references public.nodes (user_id, id) on delete cascade
);
create index learning_plans_user_idx on public.learning_plans (user_id, start_date);
```
- `PlanTarget` 유니온은 `scope + target_id` 두 컬럼으로 편다. 어댑터가 `{scope:"subject", subjectId}` ↔ `(subject, target_id)`로 바꾼다.
- 대상 노드가 지워지면 계획도 지운다(cascade). 지금 코드는 대상이 지워져도 계획이 남아 끊긴 id를 가리킨다. **합의 필요**: 계획을 지울지(추천, R7의 "하위 전부 삭제"와 같은 감각), 남기고 "삭제된 대상"으로 보여줄지.
- `scope = 'subject'`인데 대상이 과목이 아닌 경우는 지금은 클라이언트 폼이 막는다. DB에서도 막을지는 선택(트리거 필요).

### 2.6 todos — 할 일
```sql
create table public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  label      text not null,
  done       boolean not null default false,
  done_at    timestamptz,
  due_on     date,                                   -- "오늘의" 체크리스트 기준일. null = 날짜 없음
  position   text collate "C" not null,
  created_at timestamptz not null default now()
);
create index todos_user_day_idx on public.todos (user_id, due_on, position);
```
- 지금 할 일은 `app/page.tsx`의 `useState` + `dummy-data.ts` 더미이고 `lib` 함수도 `DATA_MODEL.md` 항목도 없다. 저장하려면 `lib/todos.ts`(`useTodos`, `addTodo`, `toggleTodo`, `removeTodo`)를 새로 만들어야 한다.
- `due_on`과 `done_at`은 "오늘의 체크리스트"를 날짜별로 보여주기 위한 최소한이다. **합의 필요**: 안 끝난 할 일을 다음 날로 넘길지, 페이지/계획과 연결할지. 연결은 요청 범위 밖이라 넣지 않았다.

### 2.7 study_sessions, session_segments — 세션/구간
```sql
create table public.study_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  auto_ended boolean not null default false,         -- 30분 무활동으로 마지막 활동 시각에 자동 종료(D-11)
  unique (user_id, id),
  check (ended_at >= started_at)
);
create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);

create table public.session_segments (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid(),
  session_id uuid not null,
  page_id    uuid not null,
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  check (ended_at > started_at),
  foreign key (user_id, session_id) references public.study_sessions (user_id, id) on delete cascade,
  foreign key (user_id, page_id) references public.pages (user_id, node_id) on delete cascade
);
create index session_segments_session_idx on public.session_segments (session_id);
create index session_segments_page_idx on public.session_segments (user_id, page_id, started_at);
```
- **끝난 세션만 저장한다(추천).** 진행 중 상태(`startedAt`, `openSegment`, `lastActiveAt`, 30초 heartbeat)는 지금처럼 localStorage에 둔다. 진행 중 세션까지 DB에 두면 30초마다 쓰기가 생기고, 복구 로직(R4, D-11)을 서버와 클라이언트 양쪽에 두어야 한다. 대신 "다른 기기에서 진행 중 세션 이어 보기"는 안 된다.
- `endSession()`이 끝난 세션 + 구간을 RPC 하나(`save_session`)로 넣는다. localStorage의 `log`는 업로드 후 비워서 지금의 "로그 정리 기준 없음"(DATA_MODEL 5-9) 문제도 해결한다.
- `summarySessionId`, `prefill`은 화면 상태라 저장하지 않는다.
- R5(기록되지 않은 세션 시간)는 `session_segments`와 `study_records.created_at`만으로 서버에서도 계산할 수 있다. 1단계에서는 지금처럼 클라이언트가 계산한다.
- 동작 변화: 페이지를 지우면 그 페이지의 구간도 지워진다(cascade). 지금은 페이지를 지워도 구간이 localStorage에 남아 "기록되지 않은 세션 시간"에 계속 더해진다. 기록은 같이 지워지는데 구간만 남는 쪽이 오히려 어긋난다고 봤다. **합의 필요.**

### 2.8 attachments — 첨부 메타데이터 (Storage는 6장)
```sql
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  storage_path text not null unique,                 -- '<user_id>/<id>'
  name         text not null,
  mime         text not null,
  size         integer not null check (size between 0 and 10485760),  -- MAX_ATTACHMENT_BYTES(10MB)
  created_at   timestamptz not null default now()
);
create index attachments_user_idx on public.attachments (user_id, created_at);
```

### 2.9 updated_at
`nodes`, `pages`, `study_records`에 `moddatetime` 확장 트리거로 `updated_at`을 갱신한다. 1단계에서는 기록용이고, 나중에 두 탭 동시 편집 충돌 감지(낙관적 잠금)에 쓸 수 있다.

---

## 3. RLS: 본인 데이터만

모든 `public` 테이블에 같은 정책을 건다.
```sql
alter table public.<table> enable row level security;

create policy "own rows" on public.<table>
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```
대상: `profiles`, `nodes`, `pages`, `study_records`, `learning_plans`, `todos`, `study_sessions`, `session_segments`, `attachments`.

- `auth.uid()`를 `(select …)`로 감싸면 행마다가 아니라 쿼리당 한 번 평가된다(Supabase 권장).
- `anon` 역할에는 정책이 없으므로 로그인하지 않으면 아무것도 읽거나 쓸 수 없다.
- `with check`가 있으므로 `user_id`를 남의 값으로 바꿔 넣는 것도 막힌다. 참조 대상이 남의 것인 경우는 1장의 복합 FK가 막는다.
- RPC(`create_page`, `duplicate_page`, `save_session`)는 `security invoker`로 만들어 RLS가 그대로 적용되게 한다.

---

## 4. 트리 순서: 부모별 `position`(분수 인덱스) — 추천

| | 지금: 전역 `order` 배열 | 추천: `nodes.position` |
|---|---|---|
| 저장 위치 | 사용자당 큰 배열 하나 | 각 노드 행의 컬럼 하나 |
| 이동 1회 | 배열 전체 다시 쓰기 | 옮긴 노드 행 1개 `update` (`parent_id`, `position`) |
| 삭제/생성 | 배열과 노드를 같이 맞춰야 함 | 노드만 다루면 됨 |
| 두 탭 동시 이동 | 마지막 저장이 다른 탭의 이동을 덮어씀 | 서로 다른 노드면 충돌 없음 |

- `position`은 정렬 가능한 문자열 키다(`"a0"`, `"a1"`, 둘 사이는 `"a0V"` …). 두 이웃 사이 키를 만드는 `fractional-indexing` 같은 작은 라이브러리를 쓴다. 정수 position은 끼워 넣을 때마다 뒤 형제를 모두 고쳐야 하고, float는 반복 삽입 시 정밀도가 바닥난다.
- `collate "C"`로 바이트 순 비교를 보장한다(로케일 정렬이면 키 순서가 깨진다).
- 같은 키가 생기면(동시 삽입) `id`로 동률을 깬다. 유일 제약은 걸지 않는다.
- **프론트 영향 없음**: 어댑터가 읽을 때 `position` 순으로 DFS해서 지금의 `order` 배열을 만들어 `WorkspaceState`에 넣는다. `childNodes`, `flattenTree`는 그대로다. `moveNode`는 내부에서 새 부모와 앞뒤 형제의 `position`으로 새 키를 계산한다.
- 할 일(`todos.position`)도 같은 방식이다.

---

## 5. 파생값: 저장하지 않고 계산한다 — 추천

| 값 | 결정 | 이유 |
|---|---|---|
| `status`(파생) | **저장 안 함** | "오늘"에 따라 바뀐다(`nextReviewAt <= today`). 아무것도 쓰지 않아도 날짜가 지나면 값이 변하므로 저장하면 그날로 낡는다. 오늘은 사용자 로컬 날짜라 서버가 알기도 어렵다 |
| `understanding`(파생) | 저장 안 함 | 수동값 → 최신 기록 값. 행 몇 개로 바로 계산된다 |
| `nextReviewAt` | 1단계 저장 안 함. 필요하면 트리거로 캐시 | 오늘과 무관하고 기록 + 수동 이해도만으로 정해지므로 안전하게 저장할 수 있다. 다만 지금은 쓰는 곳이 모두 클라이언트다 |
| `totalDurationMinutes`, `lastStudiedAt` | 저장 안 함 | 단순 합계/최댓값 |

- 계산은 지금처럼 `computePageStats` 한 곳에서만 한다. 규칙(`reviewOffsetDays` 등)이 아직 바뀌는 중이라, 저장된 값이 있으면 규칙을 바꿀 때마다 백필 마이그레이션이 필요해진다.
- 사용자당 데이터가 작고(페이지 수백, 기록 수천 이하) 앱이 어차피 전체를 한 번에 불러온다(7장 1단계). 계산 비용이 문제 되지 않는다.
- `pages.status`, `pages.understanding` 컬럼은 **사용자가 직접 고른 값**만 담는다(null이면 파생). 파생값이 아니라 입력값이다.
- **나중에 저장이 필요해지는 시점**: 서버가 "오늘 복습할 페이지"를 찾아야 할 때(푸시/이메일 알림 등). 그때 `pages.next_review_on date`를 추가하고 `study_records` 변경과 `pages.understanding` 변경 시 트리거로 갱신한다. `status`는 그때도 저장하지 않고 `next_review_on <= 오늘(profiles.timezone 기준)`로 쿼리한다.

---

## 6. 첨부와 그림: Storage와 블록 데이터 나누기

원칙: **바이너리 파일은 Storage, 사용자가 그린 획과 텍스트는 블록 jsonb.**

### 첨부(이미지·파일 블록) → Storage + `attachments` 테이블 + 블록에는 참조만
- 버킷 `attachments`: **비공개**, `file_size_limit = 10MB`(`MAX_ATTACHMENT_BYTES`와 같게).
- 경로: `<user_id>/<attachment_id>`. 파일명은 경로에 넣지 않는다(한글·특수문자 인코딩 문제, 이름 변경). 원래 이름은 메타데이터에 두고 다운로드 시 `download: name` 옵션으로 붙인다.
- Storage 정책(첫 폴더가 내 uid인 객체만):
```sql
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
```
- 블록 jsonb에는 **`url` 대신 `attachmentId`** 를 저장한다: `{id, type: "image"|"file", attachmentId, name, mime, size}`.
  - 비공개 버킷의 URL은 만료되는 서명 URL이라 저장할 수 없다.
  - 어댑터가 페이지를 읽을 때 `createSignedUrls`로 한 번에 서명해 `url`을 채우고, 저장할 때 `url`을 뺀다. 그래서 **`AttachmentBlock` 타입과 렌더 컴포넌트는 바뀌지 않는다.**
  - `name/mime/size`를 블록에도 두는 것은 서명 전에도 파일 카드를 그릴 수 있게 하려는 것이다.
- `storeAttachmentFile(file)`이 유일한 교체 지점이다(이미 그렇게 설계돼 있다). 업로드 → `attachments` 행 생성 → 서명 URL을 돌려준다. 내부적으로 `attachmentId`를 블록에 남겨야 하므로 `createAttachmentBlocks`도 함께 고친다(둘 다 `lib` 안).
- **왜 `attachments` 테이블을 따로 두나**: 페이지 복제 시 사본이 같은 파일을 가리킨다(`duplicatePage` 주석). 그래서 블록을 지울 때 파일을 바로 지우면 안 된다. 대신 주기적으로 "어떤 페이지 본문에서도 참조하지 않는 첨부"를 찾아 지운다(GC). 테이블이 있으면 이 대조, 사용자별 용량 합계, 업로드 도중 실패한 파일 정리가 쉬운 SQL이 된다.
- 페이지 삭제 시에도 파일은 즉시 지우지 않고 GC에 맡긴다.

### 그림 블록 → 블록 jsonb에 획 좌표 그대로
- `DATA_MODEL.md`의 결정(비트맵이 아니라 좌표, 블록 너비 비율 좌표)을 그대로 따른다. Storage에 이미지로 저장하지 않는다.
- 이유: 획 단위 지우개/되돌리기가 가능하고, 크기가 작고, 본문과 같은 저장 경로(페이지 저장 한 번)를 탄다. 복제 시 깊은 복사도 jsonb 복사로 끝난다.
- 썸네일 PNG가 필요해지면(목록 미리보기 등) 그때 Storage에 파생 파일로 추가한다. 원본은 계속 획 데이터다.

---

## 7. `lib/workspace.ts`, `lib/plans.ts` 시그니처를 유지하며 바꾸는 단계

목표: **컴포넌트 수정 없이** 저장소만 메모리 → Supabase로 바꾼다. 컴포넌트는 지금처럼 `useWorkspace()`/`usePlans()`와 export 함수만 부르고 DB를 직접 부르지 않는다(AGENTS.md).

구조: `createStore`는 그대로 "화면용 캐시"로 남는다. 각 export 함수가 ① 캐시를 바로 고치고(낙관적) ② `lib/db/*`의 저장 함수를 부른다. 실패하면 서버에서 다시 읽어 캐시를 되돌리고 토스트를 띄운다.

### 0단계. 합의 (이 PR)
- 아래 "합의할 것"을 정하고 `DECISIONS.md`로 옮긴다.

### 1단계. Supabase 준비 (UI 영향 없음)
- 프로젝트 생성, `supabase/migrations/`에 이 문서의 SQL, `supabase gen types`로 DB 타입 생성.
- 인증 붙이기(방식은 미정). 로그인 전에는 데이터 화면에 들어가지 않는다.
- 환경 변수 `NEXT_PUBLIC_DATA_SOURCE=memory|supabase`. **v0 미리보기와 로그인 없는 개발을 위해 메모리 모드를 남긴다.** 지금의 시드는 메모리 모드에서만 쓴다.

### 2단계. 읽기: 서버에서 불러와 캐시를 채운다
- 로그인 사용자의 `nodes`, `pages`, `study_records`, `learning_plans`를 한 번에 읽어 `WorkspaceState`(`groups`, `pages`, `order`)와 `LearningPlan[]`로 변환하는 매퍼를 `lib/db/`에 둔다. `order`는 `position`으로 DFS해서 만든다(4장).
- **hydration(R8, D-12)**: 서버 컴포넌트(레이아웃)에서 데이터를 읽어 클라이언트 Provider에 초기값으로 넘기고, Provider가 렌더 전에 캐시를 채운다. `useSyncExternalStore`의 서버 스냅샷도 같은 초기값을 돌려주게 `createStore`에 `hydrate(initial)`을 추가한다. 이렇게 하면 서버 렌더와 첫 클라이언트 렌더가 같다.
  - 대안(클라이언트에서 마운트 후 fetch)은 로딩 동안 "빈 트리", `/record/<id>`의 404가 깜빡이므로 추천하지 않는다.
- 첨부 서명 URL도 이때 일괄 생성한다.

### 3단계. 쓰기: 함수별 교체 (시그니처 그대로)
| 함수 | 바뀌는 내부 동작 |
|---|---|
| `createPage(input) → id` | uuid 생성, 캐시 반영 후 RPC `create_page`(`nodes` + `pages` 한 트랜잭션). 형제 맨 뒤 `position` 계산. id는 그대로 동기 반환 |
| `addGroup(name, parentId, kind) → id` | uuid 생성, `nodes` insert |
| `updatePage(id, update)` | 아래 "updatePage 처리" |
| `renamePage`, `setPageStudyEnabled` | `updatePage`를 거치므로 따로 할 일 없음 |
| `duplicatePage(id)` | 캐시에서 사본을 만든 뒤 RPC `duplicate_page`(노드, 페이지, 기록을 새 id로 한 번에). 기록의 `created_at`은 원본 유지(R7) |
| `deletePage(id)` | `nodes` 한 행 delete. 하위 노드·페이지·기록·구간·계획은 cascade |
| `moveNode(dragId, targetId, position)` | 새 `parent_id`와 이웃 사이 `position` 계산 → `nodes` 한 행 update. 순환은 트리거가 최종 방어 |
| `canMoveNode` 등 순수 함수 | 변경 없음 |
| `addPlan(plan)` | uuid 생성, `PlanTarget` → `scope/target_id` 변환 후 insert |
| `removePlan(id)` | delete |

**`updatePage(id, update)` 처리** — `DATA_MODEL.md` 4장에서 협의가 필요하다고 한 부분. 추천: 시그니처를 유지한다.
- 어댑터가 `update(이전 페이지)`로 새 페이지를 만든 뒤, 이전/새 값을 비교해 바뀐 부분만 저장한다.
  - `title` → `nodes` update
  - `tags`, `status`, `understanding`, `studyEnabled`, `studyType` → `pages` update
  - `blocks`, `note` → `pages` update, **디바운스(예: 500ms)**. 지금 본문과 제목은 키 입력마다 `updatePage`를 부른다
  - `studyRecords` → id 기준으로 비교해 추가/수정/삭제를 `study_records`에 반영
- 기록 추가는 같은 호출에서 수동 status/understanding을 지운다(`study-page-view.tsx:58`). 비교 방식이면 이것도 자연스럽게 함께 저장된다.
- 이렇게 하면 프론트 변경이 없다. 나중에 필요하면 `lib` 안에서 `addRecord` 같은 세분 함수를 추가하되, 컴포넌트 교체는 별도 PR로 한다.
- 페이지를 벗어나거나 탭을 닫을 때 대기 중인 디바운스 저장을 즉시 보낸다(`pagehide`).

### 4단계. 그 밖의 교체
- 기록 id: `newRecordId()`(uuid)로 통일하고 컴포넌트 두 곳이 이것을 부르게 한다. `sortRecordsNewestFirst` 동률 기준을 `createdAt`으로.
- 첨부: `storeAttachmentFile`/`createAttachmentBlocks`를 업로드로 교체(6장).
- 세션: `endSession()`이 끝난 세션을 `save_session`으로 업로드. 처음 한 번 localStorage의 기존 `log`를 올리고 비운다. 기존 구간의 `pageId`가 시드 id면 매칭되는 페이지가 없으므로 버린다.
- 할 일: `lib/todos.ts` 신설, `app/page.tsx`의 `useState` + 더미를 `useTodos()`로 교체(프론트 변경 1곳, 재윤 확인 필요).

### 5단계. 정리
- 메모리 시드를 데이터 모드에서 떼어내고, `recordCreatedAt`의 id 파싱 분기 제거.
- `DATA_MODEL.md`를 DB 기준으로 고치고 이 문서는 지운다.
- 이후 과제(이번 범위 밖): 본문 지연 로딩, 첨부 GC 스케줄, 서버 측 R5/R6 집계, 동시 편집 충돌 감지.

---

## 8. 합의할 것 (준혁·재윤)

1. id를 클라이언트가 uuid로 발급 (1장)
2. 그룹·페이지를 `nodes` 한 테이블 + `pages` 1:1로 (2.2)
3. 형제 순서를 `position` 분수 인덱스로 (4장)
4. 파생값은 계산, `next_review_on`은 필요해지면 트리거 캐시 (5장)
5. 세션은 끝난 것만 서버 저장, 진행 중은 localStorage (2.7)
6. 페이지 삭제 시 계획·구간도 cascade 삭제 (2.5, 2.7)
7. `updatePage(id, update)` 시그니처 유지 + 어댑터 비교 저장 (7장 3단계)
8. 할 일의 날짜 의미(이월 여부)와 `lib/todos.ts` 신설 (2.6)
9. status/study_type을 한글 값 그대로 저장할지, 영문 코드로 바꿀지 (2.3)
10. 인증 방식, 신규 사용자에게 예시 데이터를 넣을지

---

## 9. 문서와 코드의 차이 (코드 기준으로 설계함)

`DATA_MODEL.md`를 고칠 때 함께 반영해야 할 것들이다. 이 PR에서는 고치지 않았다.

1. **Block 타입**: 문서는 `h1|h2|h3|p|li|code`만 적었지만 코드에는 첨부 블록(`image`, `file`: `name, mime, size, url`)과 그림 블록이 있다. 첨부 블록은 문서에 없다.
2. **StudyNoteContent 절이 깨져 있다**: `learned` 다음에 그림 블록 절이 끼어들어 `concepts`, `confusions` 설명이 그림 블록 아래에 있다.
3. **할 일(오늘의 체크리스트)**: 문서에 없다. `app/page.tsx`의 `useState` + `dummy-data.ts`이고 `lib` 함수 뒤에 있지 않다(AGENTS.md 규칙과 다름).
4. **기록 추가 시 수동 status/understanding을 지운다**(`study-page-view.tsx:58`). 문서 R1~R3 어디에도 없는 규칙이다.
5. **복제한 기록의 id**는 `<원본 id>-<사본 페이지 id>`라서 `-r-<ms>` 패턴이 깨진다. `createdAt`이 없는 옛 기록을 복제하면 생성 시각을 잃는다(R5 영향). DB에서는 `created_at`이 항상 있어 해소된다.
6. **그룹 삭제/이름 변경 UI가 없다.** `deletePage`에 그룹 id를 넘기면 하위는 지워지지만 그룹 자신은 남는다(`groups.filter`가 그룹 자체를 거르지 않음). 지금은 호출 경로가 없어 드러나지 않는다. DB에서는 `nodes` delete 하나로 그룹/페이지 구분 없이 동작한다.
7. 학습 계획의 대상 노드가 지워져도 계획이 남는다(2.5).
