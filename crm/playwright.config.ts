import { defineConfig } from "@playwright/test";

// 端對端測試：需要一個測試用 Supabase（唔好用正式資料庫）同埋行緊嘅 app。
// 環境變數：E2E_BASE_URL、NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、
//           E2E_ADMIN / E2E_AGENT_A / E2E_AGENT_B（格式 email:password）
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    screenshot: "only-on-failure",
  },
});
