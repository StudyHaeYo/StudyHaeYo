# StudyHaeYo — AI 작업 규칙

이 저장소에서 코드를 읽거나 수정하는 AI(Claude, GPT, v0 등)는 작업 전에 아래를 먼저 따른다.

## 먼저 읽을 것 (순서대로)

1. `docs/PROJECT.md` — 서비스 개념, 역할 구분, 현재 구현 상태
2. `docs/DATA_MODEL.md` — 프론트와 백엔드의 계약. 데이터 구조나 규칙을 바꾸면 같은 PR에서 이 문서도 고친다
3. `docs/DECISIONS.md` — 이미 내린 결정과 폐기한 방향. 폐기한 방향을 다시 제안하지 않는다

그다음 `git log --oneline main -20`과 열려 있는 PR을 확인해서 현재 상태를 파악한다.
문서와 코드가 다르면 **코드가 맞다.** 다른 점을 사람에게 알려준다.

## 규칙

- `main`에 직접 커밋하지 않는다. 기능별 브랜치 → PR → 리뷰 → merge.
- 데이터 모델이나 API를 바꾸기 전에 설계안(무엇을, 왜, 영향받는 파일, 프론트 영향)을 먼저 보여주고 확인받는다.
- 요청받지 않은 구조 개편이나 새 기능을 추가하지 않는다. 기존 컴포넌트와 타입을 먼저 재사용한다.
- 페이지/기록 데이터의 접근은 `lib/workspace.ts`, `lib/plans.ts`의 함수 시그니처 뒤에 둔다. DB를 붙일 때도 UI 컴포넌트가 직접 DB를 부르지 않게 한다.
- 서버 렌더와 클라이언트 첫 렌더 결과가 달라지면 안 된다(hydration). 현재 날짜 같은 브라우저 값은 `hooks/use-today.ts` 패턴(서버 스냅샷은 null)을 따른다. `suppressHydrationWarning`으로 덮지 않는다.
- PR 전에 `pnpm run build`가 통과해야 한다(타입 검사만으로는 서버/클라이언트 경계 오류를 못 잡는다). 빌드는 타입 오류를 건너뛰도록 설정돼 있으니(`ignoreBuildErrors`) `npx tsc --noEmit`도 같이 돌린다.
- 서버 컴포넌트(`page.tsx`, `layout.tsx` 등)에서는 `lib/workspace.ts`, `lib/plans.ts`, `lib/create-store.ts`, `lib/study-stats.ts`를 직접·간접으로 import하지 않는다. 서버와 클라이언트가 같이 쓰는 상수나 함수는 `lib/goals.ts`처럼 import가 없는 파일에 둔다.
- v0의 Publish로 main에 바로 반영하지 않는다. PR의 Vercel 미리보기 빌드가 Ready인지 확인하고 merge한다.
- PR의 merge 버튼은 이재윤이 누른다. Vercel 프로젝트가 이재윤의 Hobby 계정이라, 다른 사람이 만든 merge 커밋은 배포가 막힌다(D-19). 김준혁은 리뷰와 승인(Approve)을 남긴다.
- 비밀값(API 키, Supabase `service_role` 키 등)은 코드와 저장소에 넣지 않는다. 로컬은 `.env.local`(git에 올라가지 않음), 배포는 Vercel 환경 변수를 쓴다.
- 구현되지 않은 기능을 구현된 것처럼 쓰지 않는다.
- AI는 서버 경로(`app/api/ai/chat/route.ts`)에서만 Claude API를 부른다. 키는 `ANTHROPIC_API_KEY`(서버 전용 Vercel 환경 변수)이고 `NEXT_PUBLIC_`을 붙이지 않는다. 화면은 `lib/ai.ts` 함수만 부른다.
- 문서에는 코드로 알 수 없는 것(이유, 합의, 규칙, 폐기한 방향)만 쓴다. 파일 목록이나 필드 나열을 복사해 두지 않는다.

## 스킬

`.claude/skills/`에 이 저장소에서 쓰는 스킬이 있다. 규칙이 부딪히면 이 문서가 우선한다.
- `studyhaeyo-ship`: 브랜치 → 검사 → PR → 미리보기 → merge(이재윤 계정) → 배포 확인 순서
- `web-design-guidelines`: 화면 코드 점검(접근성·포커스·폼·애니메이션). 화면을 바꾼 PR 전에 돌린다
- `emil-design-eng`: 패널·토글·토스트 같은 작은 동작을 다듬을 때. 디자인 A(차분한 문서형)에 맞게 쓴다

## 역할

- 이재윤: 프론트엔드. v0로 UI를 만들고 `v0/...` 브랜치에 올린다.
- 김준혁: 백엔드/DB/API/분석 로직.
- 데이터 구조와 API 계약은 두 사람이 함께 합의한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
