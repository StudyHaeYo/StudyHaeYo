import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseEnv } from "@/lib/supabase/env"
import { deleteAccountData } from "@/lib/account-delete"

// 탈퇴(D-49). 로그인 계정(auth.users)은 브라우저 키로 지울 수 없어서 서버에서 service_role 키로 지운다.
// 키는 서버 전용 환경 변수 SUPABASE_SERVICE_ROLE_KEY(NEXT_PUBLIC_ 없음, AGENTS.md). 없으면 설정 화면에 탈퇴가 나오지 않는다.
// 로그인 확인 → 비밀번호 다시 확인 → 지우기(순서와 이유는 lib/account-delete.ts) → 이 브라우저의 세션 쿠키 지우기.

const FAILED: Record<string, string> = {
  attachments: "첨부 파일을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
  plans: "학습 계획을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
  account: "계정을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return Response.json({ error: "지금은 탈퇴할 수 없습니다. 관리자에게 알려 주세요." }, { status: 503 })

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return Response.json({ error: "로그인이 풀렸습니다. 다시 로그인한 뒤 탈퇴해 주세요." }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof body?.password === "string" ? body.password : ""
  if (!password) return Response.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 })

  // The password again, on a throwaway client so this browser's session is untouched.
  const { url, publishableKey } = getSupabaseEnv()
  const check = createSupabaseClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: passwordError } = await check.auth.signInWithPassword({ email: user.email, password })
  if (passwordError) {
    const tooMany = passwordError.status === 429 || passwordError.code === "over_request_rate_limit"
    return Response.json(
      { error: tooMany ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : "비밀번호가 맞지 않습니다. 다시 입력해 주세요." },
      { status: tooMany ? 429 : 403 },
    )
  }
  await check.auth.signOut({ scope: "local" }).catch(() => undefined)

  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const result = await deleteAccountData(admin, user.id)
  if (!result.ok) return Response.json({ error: FAILED[result.step] }, { status: 500 })

  // The account is gone: clear this browser's session cookies too.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined)
  return Response.json({ ok: true })
}
