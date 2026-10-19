// 아직 실제 인증 없음.
// 화면은 이 두 함수만 부른다. 백엔드를 붙일 때 이 파일의 함수 안만 바꾼다(시그니처는 유지).
// 지금은 아무 일도 하지 않고 항상 성공을 돌려준다. 쿠키, 세션, 사용자 정보는 만들지 않는다.

export type AuthResult = { ok: true } | { ok: false; message: string }

export async function signIn(email: string, password: string): Promise<AuthResult> {
  void email
  void password
  return { ok: true }
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  void name
  void email
  void password
  return { ok: true }
}
