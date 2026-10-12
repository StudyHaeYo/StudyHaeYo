import { toast } from "sonner"
import { newBlockId, type AttachmentBlock } from "@/lib/study-pages"

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])

export type AttachmentPreview = "image" | "pdf" | "none"

export function previewKind(mime: string): AttachmentPreview {
  if (INLINE_IMAGE_TYPES.has(mime)) return "image"
  if (mime === "application/pdf") return "pdf"
  return "none"
}

// The only place an attachment gets its URL. Object URLs live until the tab closes, matching the
// in-memory page data; replace this with an upload that resolves to a hosted URL to persist files.
// Call only from client event handlers (never during render) so SSR output stays stable.
export async function storeAttachmentFile(file: File): Promise<string> {
  return URL.createObjectURL(file)
}

export async function createAttachmentBlocks(files: File[]): Promise<AttachmentBlock[]> {
  const tooLarge = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES)
  if (tooLarge.length > 0) {
    toast.error(
      tooLarge.length === 1
        ? `"${tooLarge[0].name}" 파일이 너무 커요`
        : `파일 ${tooLarge.length}개가 너무 커요`,
      { description: `파일당 ${formatFileSize(MAX_ATTACHMENT_BYTES)}까지 첨부할 수 있어요.` },
    )
  }

  const accepted = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
  return Promise.all(
    accepted.map(async (file) => ({
      id: newBlockId(),
      type: previewKind(file.type) === "image" ? ("image" as const) : ("file" as const),
      name: file.name || "첨부 파일",
      mime: file.type || "application/octet-stream",
      size: file.size,
      url: await storeAttachmentFile(file),
    })),
  )
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`
}
