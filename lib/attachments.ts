import { useEffect, useState } from "react"
import { toast } from "sonner"
import { currentUserId, db } from "@/lib/db/queue"
import { newBlockId, type AttachmentBlock } from "@/lib/study-pages"

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])

export type AttachmentPreview = "image" | "pdf" | "none"

export function previewKind(mime: string): AttachmentPreview {
  if (INLINE_IMAGE_TYPES.has(mime)) return "image"
  if (mime === "application/pdf") return "pdf"
  return "none"
}

const BUCKET = "attachments"
// Signed URLs live an hour; one with less than 5 minutes left is renewed before use.
const SIGNED_URL_SECONDS = 60 * 60
const RENEW_BEFORE_MS = 5 * 60 * 1000

// blob: URLs made in this tab. Any other blob: URL in a saved block points at a file that is gone.
const sessionBlobUrls = new Set<string>()
// path → blob: URL for files uploaded in this tab, so they show instantly without a round trip.
const localUrls = new Map<string, string>()
const signedUrls = new Map<string, { url: string; expiresAt: number }>()

function extensionOf(name: string) {
  const match = /\.[A-Za-z0-9]{1,8}$/.exec(name)
  return match ? match[0].toLowerCase() : ""
}

// The only place an attachment is stored. Uploads to Supabase Storage when signed in; if that isn't
// possible (no session, bucket not set up yet) the file stays in this tab only and the user is told.
// Call only from client event handlers (never during render) so SSR output stays stable.
async function storeAttachmentFile(file: File): Promise<{ url: string; path?: string; failed?: true }> {
  const url = URL.createObjectURL(file)
  sessionBlobUrls.add(url)
  const userId = currentUserId()
  if (!userId) return { url }
  const path = `${userId}/${crypto.randomUUID()}${extensionOf(file.name)}`
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
  if (error) return { url, failed: true }
  localUrls.set(path, url)
  return { url, path }
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
  if (accepted.length === 0) return []
  const loading = currentUserId()
    ? toast.loading(accepted.length === 1 ? `"${accepted[0].name}" 올리는 중…` : `파일 ${accepted.length}개 올리는 중…`)
    : null
  const stored = await Promise.all(accepted.map(storeAttachmentFile))
  if (loading !== null) toast.dismiss(loading)

  const blocks: AttachmentBlock[] = []
  let failed = 0
  stored.forEach((result, i) => {
    const file = accepted[i]
    const base = {
      id: newBlockId(),
      type: previewKind(file.type) === "image" ? ("image" as const) : ("file" as const),
      name: file.name || "첨부 파일",
      mime: file.type || "application/octet-stream",
      size: file.size,
    }
    // A failed upload stays for this tab rather than losing what the user just dropped in.
    if (result.failed) failed += 1
    blocks.push(result.path ? { ...base, url: result.url, path: result.path } : { ...base, url: result.url })
  })
  if (failed > 0) {
    toast.error(failed === 1 ? "파일을 저장하지 못했어요" : `파일 ${failed}개를 저장하지 못했어요`, {
      description: "지금 화면에서는 보이지만 새로고침하면 사라져요. 잠시 뒤 다시 올려 주세요.",
    })
  }
  return blocks
}

export type AttachmentUrlState =
  | { status: "loading"; url: null }
  | { status: "ready"; url: string }
  // Attached before Storage (dead blob: URL) or the stored file can't be opened.
  | { status: "missing"; url: null }

async function signedUrl(path: string, download?: string) {
  const key = download ? `${path}\u0000${download}` : path
  const cached = signedUrls.get(key)
  if (cached && cached.expiresAt - Date.now() > RENEW_BEFORE_MS) return cached.url
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download } : undefined)
  if (error || !data) return null
  signedUrls.set(key, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000 })
  return data.signedUrl
}

// URL to show an attachment. Starts as "loading" on every render path (server and first client render
// agree), then resolves in an effect.
export function useAttachmentUrl(block: AttachmentBlock): AttachmentUrlState {
  const [state, setState] = useState<{ key: string; value: AttachmentUrlState }>({
    key: "",
    value: { status: "loading", url: null },
  })
  const key = `${block.path ?? ""}|${block.url}`

  useEffect(() => {
    let cancelled = false
    const settle = (value: AttachmentUrlState) => {
      if (!cancelled) setState({ key, value })
    }
    if (block.path) {
      const local = localUrls.get(block.path)
      if (local) settle({ status: "ready", url: local })
      else void signedUrl(block.path).then((url) => settle(url ? { status: "ready", url } : { status: "missing", url: null }))
    } else if (block.url.startsWith("blob:") && !sessionBlobUrls.has(block.url)) {
      settle({ status: "missing", url: null })
    } else {
      settle({ status: "ready", url: block.url })
    }
    return () => {
      cancelled = true
    }
  }, [key, block.path, block.url])

  return state.key === key ? state.value : { status: "loading", url: null }
}

// Saves the file under its original name. Stored files need a signed URL that asks for a download,
// since the browser ignores `download` on cross-origin links.
export async function downloadAttachment(block: AttachmentBlock) {
  const local = block.path ? localUrls.get(block.path) : block.url
  const url = local ?? (block.path ? await signedUrl(block.path, block.name) : null)
  if (!url) {
    toast.error("파일을 내려받지 못했어요")
    return
  }
  const a = document.createElement("a")
  a.href = url
  a.download = block.name
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`
}
