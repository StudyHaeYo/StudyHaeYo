"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { settleWrites } from "@/lib/db/queue"

// 화면은 이 파일의 함수만 부른다. Supabase를 직접 부르지 않는다.
// 브라우저에서만 쓴다(서버 컴포넌트에서 import하지 않는다).

export type AuthResult = { ok: true } | { ok: false; message: string }
export type SignUpResult = { ok: true; needsEmailVerification: boolean } | { ok: false; message: string }

export interface CurrentUser {
  name: string
  email: string
}

const FALLBACK_MESSAGE = "잠시 후 다시 시도해 주세요."

// Supabase 오류 코드 → 사용자에게 보여줄 한국어 문구. 모르는 코드는 FALLBACK_MESSAGE.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 인증 링크를 눌러 주세요.",
  user_already_exists: "이미 가입된 이메일이에요.",
  email_exists: "이미 가입된 이메일이에요.",
  weak_password: "비밀번호가 너무 단순해요. 더 길거나 복잡하게 만들어 주세요.",
  email_address_invalid: "사용할 수 없는 이메일 주소예요.",
  over_email_send_rate_limit: "인증 메일을 너무 자주 보냈어요. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
  signup_disabled: "지금은 회원가입을 받지 않고 있어요.",
}

function toMessage(error: { code?: string } | null | undefined) {
  return (error?.code && ERROR_MESSAGES[error.code]) || FALLBACK_MESSAGE
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    return error ? { ok: false, message: toMessage(error) } : { ok: true }
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE }
  }
}

export async function signUp(name: string, email: string, password: string): Promise<SignUpResult> {
  try {
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) return { ok: false, message: toMessage(error) }
    // 이메일 인증을 켜 두면 이미 가입된 이메일도 오류 없이 돌아온다. 이때 identities가 비어 있다.
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, message: ERROR_MESSAGES.user_already_exists }
    }
    return { ok: true, needsEmailVerification: data.session === null }
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE }
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    // Finish pending saves while the session is still valid; lib/db/sync.ts clears the cache after sign-out.
    await settleWrites()
    const { error } = await createClient().auth.signOut()
    return error ? { ok: false, message: toMessage(error) } : { ok: true }
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE }
  }
}

// 로그인한 사용자. 서버 렌더와 첫 렌더에서는 null이고, 마운트 후에 채워진다(hydration 안전).
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const apply = (u: { email?: string; user_metadata?: { display_name?: unknown } } | null | undefined) => {
      if (!u) return setUser(null)
      const email = u.email ?? ""
      const displayName = typeof u.user_metadata?.display_name === "string" ? u.user_metadata.display_name.trim() : ""
      setUser({ name: displayName || email.split("@")[0] || "사용자", email })
    }
    supabase.auth.getUser().then(({ data }) => apply(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user))
    return () => data.subscription.unsubscribe()
  }, [])

  return user
}

// 로그인 후 돌아갈 주소. 같은 사이트 안의 경로만 허용한다(외부 주소로 보내지 않기).
export function safeNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  if (next === "/login" || next === "/signup" || next.startsWith("/auth/")) return "/"
  return next
}
