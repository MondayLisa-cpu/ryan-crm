# 先在你的 Mac 試，再交接 Ryan

## 1. 無帳戶、無正式資料的操作示範

安裝 Node.js 24 LTS，下載 `codex/ryan-local-handoff` 分支的 ZIP，解壓完整資料夾。
在資料夾內開啟終端機，執行：

```sh
node crm/scripts/local/preview.mjs
```

亦可雙擊根目錄 Preview-Ryan-CRM.command；如 macOS 阻止執行，用上述終端指令，不需要降低系統安全設定。
在瀏覽器輸入 http://127.0.0.1:3100。
這是明確標示的虛構資料操作示範，沒有 AI、帳戶、Google 或 Telegram 連線。測試取消、確認、兩位員工更新及重複確認；重載清除資料。不得輸入真實客戶資料。

## 2. 真實整合測試（須先完成設定）

依 LOCAL_START.md 安裝依賴。正式資料庫不可拿來執行測試寫入。
用隔離測試 Supabase，按編號安裝 migrations 0001–0007。不要把 0007 直接重跑到已套用的資料庫。
透過 Supabase 建立測試使用者，設定一位 admin 及兩位 agent；停用公開註冊。
填好 crm/.env.local 的測試 Supabase 資料及測試加密鑰匙。既有正式資料使用原本鑰匙，不能替換。

Telegram：
1. 在 Telegram 官方 BotFather 建立獨立測試 bot。將 token 及 bot username 安全填入 .env.local。
2. 產生至少 32 字元隨機 TELEGRAM_WEBHOOK_SECRET，放進同一檔案，不貼聊天。
3. 設定現有整理服務所需的 ANTHROPIC_API_KEY、可用的 AI_MODEL（須確認帳戶可用模型）；API 用量另計，不包含於 Codex 訂閱。
4. 執行 `node crm/scripts/local/run.mjs dev`，用測試帳戶登入，進入「Telegram 助理」。
5. 每位員工及 Ryan 分別產生自己的綁定連結，在自己的 Telegram 按 Start。連結 10 分鐘及單次有效。
6. 另一個終端執行 `node crm/scripts/local/telegram.mjs`。同一 bot 只啟動一個輪詢程序；不與 webhook 同時使用。本程式不會刪除已有 webhook。
7. 傳見客內容，檢查摘要，回覆 `確認 編號` 或 `取消 編號`。確認後原文及整理內容加密保存至「團隊更新」，Ryan 可看全部，員工只看自己。
8. Ryan 綁定後會收到不包含客戶內容的更新通知。通知採至少一次傳遞：Telegram 已收到但網路回應遺失時可能重複通知；紀錄儲存仍會去重。
9. 不支援語音檔：先用手機鍵盤語音轉文字。只處理私人文字訊息。

Google：
1. Google Cloud 啟用 Gmail API、Google Calendar API，設定 OAuth consent screen，加入測試使用者。
2. 建立 Web application OAuth client，redirect URI 精確設定為 `http://127.0.0.1:3000/api/google/callback`。
3. 安全填入 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REDIRECT_URI。
4. 主管登入後從「Telegram 助理 → 電郵與日程」按連接，由帳戶本人完成 Google 授權。
5. 查看最近 10 封未讀郵件的 Google 原文摘要及未來 20 項日程。郵件不標記已讀、不寄出。
6. 明確填寫日期時間和時區、勾選確認後新增個人日程；目前不發邀請、不加入參與者。重複送出同一表單使用同一事件 ID。
7. Google 測試模式授權可能到期，需重新連接。移除本地保存授權後，若要完整撤銷，到 Google 帳戶第三方連接設定撤銷。

## 3. 本次已實作範圍與未完成範圍

已實作：獨立示範頁；Telegram 綁定／輪詢／摘要／編號確認取消／加密團隊更新／主管通知；手動培訓指派和進度；Google OAuth + PKCE + 加密 refresh token；Gmail 原文摘要；查看和確認新增 Calendar 日程。

仍未完成：Telegram 整理結果自動合併既有客戶卡、活動分及業績；多層主管權限；AI 電郵分類／回覆草稿；日程從自然語言自動解析；Telegram 自動抽取培訓項目。現有業績與每日待辦功能保留，並未接上新 Telegram 流程。這些不能當成已完成的整合。

本機功能需要電腦保持開機，網站和輪詢都在運作。不保證 24 小時服務。正式部署需另行設定常駐程序、資料備份、OAuth 應用發布及通知監察。

## 4. 移交 Ryan

交付完整程式碼 ZIP、此文件、LOCAL_START.md、AGENTS.md。不要把你電腦的 node_modules、.next、.env.local 或客戶資料一併複製。
在 Ryan 電腦重做依賴安裝及帳戶授權；Google 用 Ryan 自己帳戶，Telegram 用指定 bot。
此 ZIP 是程式碼備份，不是資料庫備份或密鑰備份。
下一位 agent 先讀上述文件，確認目前分支及部署，完成未接通功能及驗收後才可稱為正式完成。
