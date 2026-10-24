import type { MetadataRoute } from "next"

// 홈 화면에 추가 (PWA): installs as its own window with the navy icon. No service worker, so it still needs
// the network (the data lives in Supabase anyway).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "스터디 해요",
    short_name: "스터디 해요",
    description: "노트, 학습 기록, 복습을 한곳에서 관리하는 학습 노트",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e2b58",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
