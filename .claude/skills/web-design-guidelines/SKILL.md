---
name: web-design-guidelines
description: Review UI code against the Web Interface Guidelines (accessibility, focus, forms, animation, typography, hydration). Use when asked to review UI, check accessibility, audit design or UX, or before opening a PR that changes screens.
---

# Web Interface Guidelines review

Review the given files (or ask which ones) against `rules.md` in this folder and report findings in its `file:line` format. Review only; don't change code unless asked.

## Project notes (StudyHaeYo)

- `AGENTS.md` wins over any rule here. In particular: hydration follows `hooks/use-today.ts` (no `suppressHydrationWarning`), and design A (navy, document style, no gamification) stays.
- UI copy is Korean. Skip "Title Case" and "`&` over and"; keep the rest of Content & Copy in spirit (specific button labels, errors say what to do next, `…` for loading text).
- Rules apply to code in `app/` and `components/`. Report each finding once, most user-visible first.

## Source

`rules.md` is a pinned copy of `command.md` from github.com/vercel-labs/web-interface-guidelines
(commit 434b7f91364665f2f733b310ec54809bf8f37937, MIT, © Vercel Labs). The upstream skill
(vercel-labs/agent-skills `web-design-guidelines`) fetches that file live on every run; this copy is
pinned so reviews are repeatable and the rules were read before being added. To update, replace
`rules.md` with a newer `command.md` in a PR.
