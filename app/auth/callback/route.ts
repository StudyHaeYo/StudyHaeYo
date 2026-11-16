import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 메일 링크가 돌아오는 곳. 가입 인증은 로그인 화면으로, 비밀번호 재설정(next=/reset-password)은 새 비밀번호 화면으로
// 보낸다. 링크가 만료됐거나 다른 브라우저에서 열어 코드를 바꾸지 못하면 각자의 시작 화면에서 다시 하게 한다.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const isRecovery = requestUrl.searchParams.get("next") === "/reset-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(isRecovery ? "/reset-password" : "/login?verified=1", request.url));
    }
  }

  return NextResponse.redirect(
    new URL(isRecovery ? "/forgot-password?error=link" : "/login?error=verification", request.url),
  );
}
