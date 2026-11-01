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

type UploadFailure = "signed-out" | "no-bucket" | "denied" | "too-large" | "network" | "unknown"

const FAILURE_HINTS: Record<UploadFailure, string> = {
  "signed-out": "로그인 정보를 확인하지 못했어요. 다시 로그인한 뒤 올려 주세요.",
  "no-bucket": "파일 저장소가 아직 설정되지 않았어요. 관리자에게 알려 주세요.",
  denied: "파일을 올릴 권한이 없어요. 다시 로그인한 뒤 올려 주세요.",
  "too-large": "저장소가 받을 수 있는 크기를 넘었어요.",
  network: "인터넷 연결을 확인하고 다시 올려 주세요.",
  unknown: "잠시 뒤 다시 올려 주세요.",
}

// Storage errors carry the API's own status in `statusCode` (the HTTP status can differ, e.g. a missing
// bucket comes back as HTTP 400 with statusCode "404") and a service code such as "NoSuchBucket".
function failureOf(error: unknown): UploadFailure {
  const { name, statusCode, code, message } = (error ?? {}) as Record<string, unknown>
  if (name === "StorageUnknownError") return "network"
  if (code === "NoSuchBucket" || (statusCode === "404" && /bucket/i.test(String(message)))) return "no-bucket"
  if (statusCode === "401" || statusCode === "403") return "denied"
  if (statusCode === "413" || code === "EntityTooLarge") return "too-large"
  return "unknown"
}

async function uploadToStorage(file: File): Promise<{ path: string } | { failure: UploadFailure }> {
  const userId = currentUserId()
  if (!userId) return { failure: "signed-out" }
  const path = `${userId}/${crypto.randomUUID()}${extensionOf(file.name)}`
  try {
    const { error } = await db()
      .storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
    return error ? { failure: failureOf(error) } : { path }
  } catch (error) {
    return { failure: failureOf(error) }
  }
}

// The only place an attachment is stored. Uploads to Supabase Storage; if that fails the file stays in
// this tab only (blob: URL, no `path`) and the caller tells the user why and offers a retry.
// Call only from client event handlers (never during render) so SSR output stays stable.
async function storeAttachmentFile(file: File): Promise<{ url: string; path?: string; failure?: UploadFailure }> {
  const url = URL.createObjectURL(file)
  sessionBlobUrls.add(url)
  const result = await uploadToStorage(file)
  if ("failure" in result) return { url, failure: result.failure }
  localUrls.set(result.path, url)
  return { url, path: result.path }
}

// A block that was added while its upload failed. `onStored` gives it its Storage path after a retry
// and returns false if the block is gone by then, in which case the just-uploaded file is removed again.
type PendingUpload = { file: File; block: AttachmentBlock }
export type AttachmentStored = (blockId: string, path: string) => boolean

function reportFailedUploads(pending: PendingUpload[], failures: UploadFailure[], onStored: AttachmentStored) {
  // Show the most specific reason: one that applies to every file, else the first one.
  const reason = failures.every((f) => f === failures[0]) ? failures[0] : "unknown"
  toast.error(pending.length === 1 ? "파일을 저장하지 못했어요" : `파일 ${pending.length}개를 저장하지 못했어요`, {
    description: `${FAILURE_HINTS[reason]} 지금 화면에서는 보이지만 새로고침하면 사라져요.`,
    duration: Infinity,
    action: { label: "다시 올리기", onClick: () => void retryUploads(pending, onStored) },
  })
}

async function retryUploads(pending: PendingUpload[], onStored: AttachmentStored) {
  const loading = toast.loading(
    pending.length === 1 ? `"${pending[0].file.name}" 다시 올리는 중…` : `파일 ${pending.length}개 다시 올리는 중…`,
  )
  const results = await Promise.all(pending.map(({ file }) => uploadToStorage(file)))
  toast.dismiss(loading)

  const stillFailed: PendingUpload[] = []
  const failures: UploadFailure[] = []
  let saved = 0
  results.forEach((result, i) => {
    const item = pending[i]
    if ("failure" in result) {
      stillFailed.push(item)
      failures.push(result.failure)
      return
    }
    localUrls.set(result.path, item.block.url)
    if (onStored(item.block.id, result.path)) saved += 1
    else void db().storage.from(BUCKET).remove([result.path])
  })
  if (saved > 0) toast.success(saved === 1 ? "파일을 저장했어요" : `파일 ${saved}개를 저장했어요`)
  if (stillFailed.length > 0) reportFailedUploads(stillFailed, failures, onStored)
}

export async function createAttachmentBlocks(files: File[], onStored: AttachmentStored): Promise<AttachmentBlock[]> {
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
  const pending: PendingUpload[] = []
  const failures: UploadFailure[] = []
  stored.forEach((result, i) => {
    const file = accepted[i]
    const base = {
      id: newBlockId(),
      type: previewKind(file.type) === "image" ? ("image" as const) : ("file" as const),
      name: file.name || "첨부 파일",
      mime: file.type || "application/octet-stream",
      size: file.size,
    }
    const block: AttachmentBlock = result.path ? { ...base, url: result.url, path: result.path } : { ...base, url: result.url }
    blocks.push(block)
    // A failed upload stays for this tab rather than losing what the user just dropped in.
    if (result.failure) {
      pending.push({ file, block })
      failures.push(result.failure)
    }
  })
  if (pending.length > 0) reportFailedUploads(pending, failures, onStored)
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
