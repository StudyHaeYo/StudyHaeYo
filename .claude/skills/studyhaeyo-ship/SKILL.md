---
name: studyhaeyo-ship
description: Ship a change to StudyHaeYo the agreed way — feature branch, checks, PR, Vercel preview, merge by 이재윤's account, production deploy check. Use whenever code or docs in this repo are about to be committed, opened as a PR, merged or deployed.
---

# StudyHaeYo: branch → PR → preview → merge → deploy

`AGENTS.md` is the source of the rules; this is the order to apply them in. Stop and ask when a step says so.

## 0. Before writing code

- Read `docs/PROJECT.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md` if this session hasn't. Don't re-propose a direction marked 폐기.
- Changing the data model or the API? Show the design first (what, why, files, frontend impact) and wait for a yes. Update `docs/DATA_MODEL.md` in the same PR.
- New SQL goes in `supabase/migrations/YYYYMMDD_<name>.sql`. The code must keep working before it is run (see `lib/db/sync.ts`: retry without the new column on `42703`, hide the UI behind a `…Ready` flag).

## 1. Branch

```bash
git checkout main && git pull --ff-only origin main
git checkout -b <feat|fix|docs|chore>/<short-name>
```

Never commit to `main`.

## 2. Checks (all must pass)

```bash
npx tsc --noEmit        # the build skips type errors (ignoreBuildErrors)
pnpm run build          # catches server/client boundary errors tsc misses
```

Also check by hand:
- Server components (`page.tsx`, `layout.tsx`) don't import `lib/workspace.ts`, `lib/plans.ts`, `lib/create-store.ts`, `lib/study-stats.ts`, directly or through another file.
- Browser-only values (today's date, localStorage) follow `hooks/use-today.ts`: `useSyncExternalStore` with a server snapshot. No `suppressHydrationWarning`.
- AI calls go only through `app/api/ai/chat/route.ts`; screens call `lib/ai.ts`. No secret in code; no `NEXT_PUBLIC_` on keys.
- Screens changed? Run the `web-design-guidelines` review on the changed files and fix what applies.

## 3. Commit, push, PR

- Commit message: Korean summary line (`feat:` / `fix:` / `docs:` / `chore:`), body with what and why. Add the attribution lines the session asks for.
- `git push -u origin <branch>` (the `-u` matters: without an upstream, stop hooks report the branch as unpushed).
- Open the PR against `main` with `gh api repos/StudyHaeYo/StudyHaeYo/pulls -f title=… -f head=<branch> -f base=main -F body=@<file>`. Body: 무엇 / 왜 / 확인 (what was run and seen).

## 4. Vercel preview

Poll `gh api repos/StudyHaeYo/StudyHaeYo/commits/<head sha>/status --jq .state` until it is not `pending`. `success` = preview Ready. On `failure`, read the build log in Vercel and fix before anyone reviews.

## 5. Merge — only when 이재윤 says so

- The Vercel project is on 이재윤's Hobby account: a merge commit authored by anyone else is not deployed (D-19). 김준혁 reviews and approves; he doesn't merge.
- Merge only after an explicit "merge" from 이재윤 in this conversation. Check `gh api user --jq .login` is `jylee2003`; if it isn't, stop and ask 이재윤 to press the merge button.
- `gh api -X PUT repos/StudyHaeYo/StudyHaeYo/pulls/<n>/merge -f merge_method=merge`
- Never use v0's Publish to push to `main`.

## 6. After merge

- Poll the merge commit's status the same way; `success` = production (studyhaeyo.vercel.app) deployed.
- `git checkout main && git pull --ff-only && git branch -D <branch>` (GitHub deletes the remote branch on merge).
- If the change needs SQL, say so plainly: which file, who runs it (김준혁 in the Supabase SQL Editor), and what stays hidden until then.
