import type { SupabaseClient } from "@supabase/supabase-js"

// 탈퇴(D-49)에서 서버가 지우는 순서. app/api/account/delete/route.ts가 service_role 클라이언트로 부른다(서버 전용).
// 1) 첨부 파일: Storage에 파일이 남은 계정은 지울 수 없다. 파일은 attachments/<사용자 id>/<파일 id>에 있다
//    (supabase/migrations/20261023_attachments_storage.sql).
// 2) 학습 계획: target_node_id가 노트를 on delete restrict로 가리켜서, 계정과 같이 지울 때 노트보다 늦게 지워지면 막힌다.
// 3) 계정: 노트 · 학습 기록 · 할 일 · D-day · 프로필은 on delete cascade로 같이 지워진다.

export const ATTACHMENTS_BUCKET = "attachments"
const LIST_PAGE = 1000
const MAX_PASSES = 100

export type DeleteStep = "attachments" | "plans" | "account"
export type DeleteResult = { ok: true } | { ok: false; step: DeleteStep }

export async function deleteAccountData(admin: SupabaseClient, userId: string): Promise<DeleteResult> {
  if (!(await removeAttachments(admin, userId))) return { ok: false, step: "attachments" }

  const plans = await admin.from("learning_plans").delete().eq("user_id", userId)
  if (plans.error) return { ok: false, step: "plans" }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { ok: false, step: "account" }
  return { ok: true }
}

// Each pass lists from the start: the files it removes drop out of the next list.
async function removeAttachments(admin: SupabaseClient, userId: string) {
  const bucket = admin.storage.from(ATTACHMENTS_BUCKET)
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { data, error } = await bucket.list(userId, { limit: LIST_PAGE })
    if (error) return false
    const paths = (data ?? []).filter((f) => f.name).map((f) => `${userId}/${f.name}`)
    if (paths.length === 0) return true
    const { error: removeError } = await bucket.remove(paths)
    if (removeError) return false
  }
  return false
}
