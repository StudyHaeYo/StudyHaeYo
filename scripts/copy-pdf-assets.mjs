// Copies pdf.js character maps and standard fonts to public/pdfjs so Korean (CID-font) PDFs render.
// Runs before `next dev` / `next build`; the copy is not committed (see .gitignore).
import { cpSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const root = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"))
mkdirSync("public/pdfjs", { recursive: true })
for (const dir of ["cmaps", "standard_fonts"]) cpSync(join(root, dir), join("public/pdfjs", dir), { recursive: true })
