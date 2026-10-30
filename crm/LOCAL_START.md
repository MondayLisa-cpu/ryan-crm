# Ryan CRM 本機啟動與交接

本機運行的是網站伺服器，資料仍在原有 Supabase；不是離線資料庫或客戶資料備份。
下載完整 repository ZIP 並解壓，不要從根目錄執行 npm start（那是另一個 Ocean 應用）。
先安裝 Node.js 24 LTS。在解壓後的 repository 開啟終端機：

```sh
node crm/scripts/local/run.mjs setup
```

此步依鎖檔安裝依賴，只在不存在時建立 crm/.env.local。用編輯器安全填入 Supabase URL、anon key、service role key、原本 DATA_ENCRYPTION_KEY。不要把檔案上傳 GitHub或貼進聊天。設定值不包含於 ZIP；下載程式碼無法還原密鑰。

```sh
node crm/scripts/local/run.mjs doctor
node crm/scripts/local/run.mjs check
node crm/scripts/local/run.mjs dev
```

啟動後在本機瀏覽器輸入 http://127.0.0.1:3000/login。登入頁必須正常顯示，使用 Ryan 本人帳戶登入；檢查已有資料時不要建立測試客戶。缺少加密鑰匙時不能正常讀取舊客戶資料。

正式模式（先停止 dev，以免共用 .next 產生衝突）：

```sh
node crm/scripts/local/run.mjs build
node crm/scripts/local/run.mjs start
```

Ctrl+C 停止網站。電腦關機或休眠會停止本機服務，不能承諾 24 小時接收 Telegram／通知。

## 已有與未完成

已有：客戶管理、權限、業績、活動、每日計劃、主管週檢視、WhatsApp 整理與 signed bridge。
需求見 docs/assistant-requirements.md。Telegram、Google OAuth、Gmail 助理、Google Calendar 同步、培訓紀錄及推送通知尚未實作完成，不能當成已接通。
Codex 訂閱供本人使用開發 agent；不等於應用程式 API 額度或常駐 bot 服務。現有自動整理使用 Anthropic API，需另行配置及確認費用。

## 給下一位 Codex agent

閱讀根目錄 AGENTS.md、此文件、docs/assistant-requirements.md、PLANNER_RELEASE.md。
先查看 git status 和最新遠端，保留既有工作；不要重設、覆蓋正式資料或重新產生既有資料的加密鑰匙。
先執行 check；檢查環境變數只報名稱和是否存在，不輸出值。
在獨立測試資料庫驗證新 migration，不要因為 ZIP 重新下載就重跑正式 migration。
Google 使用 Ryan 本人 OAuth 同意，不收密碼。Telegram 每位同事綁定自己的已登入帳戶，Ryan 保留主管全隊查看權限。
外寄電郵、日曆邀請須明確確認。所有重試需要去重和可靠 receipt；不能以草稿狀態當資料保存成功。
交接時分開列明：程式完成、單元驗證、遠端整合驗證、部署；不要把待辦描述成已運作。
