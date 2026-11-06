// Screen code names a role color (action · attention · danger · success, app/globals.css), never a Tailwind palette
// color such as indigo-600 or amber-50, so changing the design or adding a dark theme changes values in one place.
// Usage: pnpm run check:colors (exits 1 and lists file:line when a palette class is found).
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const roots = ["app", "components", "hooks", "lib"]
const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
const property =
  "bg|text|border(?:-[xytrbl])?|ring(?:-offset)?|outline|fill|stroke|from|to|via|divide|decoration|accent|caret|placeholder|shadow"
const pattern = new RegExp(`\\b(?:${property})-(?:${palette})-\\d{2,3}\\b`, "g")

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(tsx?|jsx?)$/.test(name)) yield path
  }
}

const found = []
for (const root of roots) {
  for (const file of files(root)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const m of line.matchAll(pattern)) found.push(`${file}:${i + 1}  ${m[0]}`)
      })
  }
}

if (found.length > 0) {
  console.error(`색 이름 클래스 ${found.length}개 — 역할 토큰(action · attention · danger · success)으로 바꿔 주세요:`)
  for (const f of found) console.error(`  ${f}`)
  process.exit(1)
}
console.log("check:colors 통과 (색 이름 클래스 없음)")
