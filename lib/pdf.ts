"use client"

import type { PDFDocumentProxy } from "pdfjs-dist"

// pdf.js is large; it loads only when a PDF is opened for note-taking. The "legacy" build carries
// polyfills for newer JS APIs the modern build assumes (e.g. Map#getOrInsertComputed), which current
// Safari and many Chrome versions still lack.
let loader: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null

function loadPdfjs() {
  loader ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString()
    return pdfjs
  })
  return loader
}

export type { PDFDocumentProxy }

// Opens a PDF from an attachment URL (signed Storage URL or this tab's blob: URL).
// `close` frees the document and its worker; call it when the viewer goes away.
export async function openPdf(url: string): Promise<{ doc: PDFDocumentProxy; close: () => void }> {
  const pdfjs = await loadPdfjs()
  const response = await fetch(url)
  if (!response.ok) throw new Error(`PDF를 불러오지 못했어요 (${response.status})`)
  const data = new Uint8Array(await response.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  return { doc, close: () => void task.destroy() }
}
