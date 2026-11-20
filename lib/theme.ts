// 화면 테마(D-48): 밝게 · 어둡게 · 기기 설정 따라. 어떤 테마를 고를지는 기기마다의 편의라 학습 데이터가 아니다.
// 그래서 DB가 아니라 이 브라우저의 쿠키에 둔다. 쿠키라서 서버도 첫 HTML부터 같은 테마로 그린다: app/layout.tsx가
// 읽어 <html data-theme>에 넣고, 색은 app/globals.css의 `dark` 변형이 바꾼다. 서버 렌더와 첫 클라이언트 렌더가
// 같으므로 hydration이 맞고, 화면이 밝게 그려졌다가 어두워지는 깜빡임도 없다.
// import가 없는 파일이라 서버 컴포넌트(layout, settings page)와 클라이언트가 같이 쓴다(AGENTS.md).

export type ThemeChoice = "light" | "dark" | "system"

export const THEME_COOKIE = "studyhaeyo-theme"

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "밝게" },
  { value: "dark", label: "어둡게" },
  { value: "system", label: "기기 설정 따라" },
]

// 쿠키가 없거나 모르는 값이면 밝게: 지금까지의 모습(디자인 A)이 기본이고, 어둡게는 고른 사람만 본다.
export function parseTheme(value: string | undefined | null): ThemeChoice {
  return value === "dark" || value === "system" ? value : "light"
}

// 1년. 경로는 사이트 전체, 다른 사이트로 보내지 않는다.
export function themeCookie(choice: ThemeChoice) {
  return `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`
}
