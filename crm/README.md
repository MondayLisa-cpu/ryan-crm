# 跟客系統（第一版）

保險團隊準客戶跟進系統，用嚟取代紙本《Prospect Check List》。手機同電腦都用得，介面係繁體中文。

**已有：** 登入、權限、準客戶卡（RR／NR1／NR2／FNA／PC 五頁表格，照《Check List 2026》）、看板（可以拖拉）、簽單條件自動判斷、四季人脈（拖拉＋行動清單＋拖去「已簽」）、每月生意表（AFYP／Revenue／佣金 vs 目標）、WARS 每週活動分、PDCA 季度記錄＋年度 OKR、WhatsApp 助手（見完客講內容自動整理入 app）、Ryan 主管頁、員工帳戶管理、審計記錄。

技術：Next.js（放喺 GitHub，部署去 Vercel）＋ Supabase（資料同登入，用新加坡伺服器）。你部電腦唔使裝任何嘢。

---

## 一鍵部署（建議）

有 Supabase 同 Vercel 嘅 access token 就可以一句過搞掂下面第 1–8 步（開新加坡項目、建資料庫、驗證權限、部署、開 Ryan 帳戶）：

```bash
cd crm
SUPABASE_ACCESS_TOKEN=… VERCEL_TOKEN=… node scripts/deploy.mjs --admin-email ryan@你的公司.com
```

完成後網址、Ryan 臨時密碼同加密鑰匙會寫入 `crm/.deploy-output.json`（已 gitignore）。⚠️ 加密鑰匙要另外收好。

## 一次性設定（手動，大約 20 分鐘，全部喺瀏覽器做）

### 1. 開 Supabase 項目
1. 去 <https://supabase.com> 註冊，撳 **New project**。
2. **Region 揀 `Southeast Asia (Singapore)`**（Supabase 冇香港伺服器，新加坡係最近嘅）。
3. 設一個資料庫密碼，記低佢，收埋喺安全地方。

### 2. 建立資料庫
1. Supabase 左邊選單 → **SQL Editor** → **New query**。
2. 打開 GitHub 上面嘅 `crm/supabase/migrations/0001_init.sql`，全部複製，貼入去，撳 **Run**。見到 `Success` 就搞掂。
3. 再用同樣方法順序行 `0002_seasons.sql`（四季人脈）、`0003_activity_pdca.sql`（活動分＋PDCA）、`0004_whatsapp.sql`（WhatsApp 助手）同 `0005_business.sql`（每月生意表）。之後每次有新嘅 `00xx_….sql`，都係按編號順序行一次。

### 3. 熄咗「自己註冊」
Supabase → **Authentication** → **Sign In / Providers** → **Email**：
- 熄咗 **Allow new users to sign up**（帳戶只可以由 Ryan 開）
- 熄咗 **Confirm email**

### 4. 開 Ryan 嘅管理員帳戶
1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**，填 Ryan 嘅電郵同密碼，剔 **Auto Confirm User**。
2. 返去 **SQL Editor** 行下面呢句（換做 Ryan 嘅電郵）：
   ```sql
   update public.profiles set role = 'admin', full_name = 'Ryan' where email = 'ryan@你的公司.com';
   ```
   之後其他員工帳戶由 Ryan 喺系統入面「員工帳戶」頁自己開，唔使再入 Supabase。

### 5. 驗證權限（建議每次改資料庫之後都做）
**SQL Editor** → 貼入 `crm/supabase/tests/rls_check.sql` → **Run**。
- 見到紅色 error 寫住 **「✅ 全部 RLS 測試通過」** = 正常（呢個 error 係刻意嘅，用嚟還原測試資料，唔會留低任何嘢）。
- 見到 **「❌ FAIL: …」** = 有問題，唔好用住，搵開發者。

### 6. 產生加密鑰匙
客戶姓名、職業同所有表格內容都會加密先存入資料庫。需要一條 32 bytes 嘅鑰匙：
- Supabase **SQL Editor** 行：
  ```sql
  select encode(extensions.gen_random_bytes(32), 'base64') as key;
  ```
  複製出嚟嗰串（44 個字元，`=` 結尾）就係鑰匙。
- ⚠️ **呢條鑰匙一定要另外安全保存（例如密碼管理器）。遺失咗 = 所有客戶資料無法解密，冇得救。** 亦唔好俾任何人。

### 7. 部署去 Vercel
1. 去 <https://vercel.com> 用 GitHub 登入 → **Add New → Project** → 揀呢個 repo。
2. **Root Directory 設做 `crm`**（重要）。
3. **Environment Variables** 加以下 4 個（數值喺 Supabase → **Project Settings → API**）：

   | 名稱 | 數值 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key（保密！） |
   | `DATA_ENCRYPTION_KEY` | 第 6 步嘅鑰匙 |

4. 撳 **Deploy**。完成後 Vercel 會俾你一條網址，Ryan 用第 4 步嘅帳戶登入就用得。
5. （伺服器已經設定喺新加坡 `sin1` 運行，同資料庫同區，速度最快。）

### 8. 喺 Supabase 填返網址
Supabase → **Authentication → URL Configuration** → **Site URL** 填 Vercel 俾你嗰條網址。

---

## WhatsApp 助手（可選）

員工見完客，喺 WhatsApp 打字講見客內容 → AI（Claude）整理成表格欄位、簽單條件、活動分 → 回覆一份摘要 → 員工回覆「確認」先寫入 app。

**流程重點**
- 一定要員工確認先寫入；「取消」就放棄；2 小時內再講嘢會當補充同一份。
- 長文字欄位加喺原有內容後面（標日期），唔會覆蓋舊資料；簽單條件只會剔、唔會剔走。
- 搵唔到嘅客名會開新客卡（摘要會標「🆕 新客」）；名字似幾個客就會叫你講全名。
- 員工只可以寫入自己嘅客；審計記錄會標「WhatsApp」。
- 暫時只收文字（可以用手機鍵盤嘅🎤語音輸入）。

**設定（大約 30 分鐘）**
1. **WhatsApp 號碼**：準備一個**未用過 WhatsApp** 嘅電話號碼做「團隊助手」號碼（一般 WhatsApp／WhatsApp Business App 嘅號碼唔用得，要先刪除帳戶）。
2. 去 <https://developers.facebook.com> → **My Apps → Create App** → 揀 **Business** → 加入 **WhatsApp** 產品。
3. **WhatsApp → API Setup**：加入同驗證第 1 步嘅號碼，記低 **Phone number ID**。
4. **永久 Token**：Meta Business Suite → **Business Settings → System Users** → 新增 System User（Admin）→ **Generate token**，揀你個 App，權限剔 `whatsapp_business_messaging`、`whatsapp_business_management`。
5. **App Secret**：App 嘅 **Settings → Basic → App Secret**。
6. **Claude API key**：<https://console.anthropic.com> → API Keys（要先充值）。
7. 喺 Vercel 加環境變數（見 `.env.example`）：`ANTHROPIC_API_KEY`、`WHATSAPP_TOKEN`、`WHATSAPP_PHONE_NUMBER_ID`、`WHATSAPP_APP_SECRET`、`WHATSAPP_VERIFY_TOKEN`（自己作一串隨機字）、`WHATSAPP_DISPLAY_NUMBER`、`APP_URL`，然後 Redeploy。
8. **Webhook**：App → **WhatsApp → Configuration → Webhook → Edit**：
   - Callback URL：`https://你的網址/api/whatsapp`
   - Verify token：第 7 步嗰串
   - 撳 **Verify and save**，再喺 Webhook fields **Subscribe `messages`**。
9. Ryan 喺 app「員工帳戶」→ 每位員工 WhatsApp 欄撳「設定」，填佢哋自己嘅手機號碼（香港號碼打 8 位數）。
10. 員工 WhatsApp 助手號碼講「幫助」試下。

**費用（大概）**：員工主動 send 訊息、助手 24 小時內回覆屬「服務對話」，Meta 現時唔收費；Claude API 每段訊息估計大約 HK$0.2–0.5（視乎長短）；可以喺 Anthropic Console 設每月上限。

**私隱（請同 Ryan 確認）**：訊息內容會經 Meta（WhatsApp）同 Anthropic（Claude，伺服器喺美國）處理。Anthropic 預設唔會用 API 資料訓練模型。建議喺收集個人資料聲明（PICS）提及會用雲端服務處理資料。系統唔需要身份證號碼，亦唔好喺 WhatsApp 講。

---

## 點用

| 角色 | 做到乜 |
|---|---|
| **員工** | 「活動分」每日記 R／N／A／RR／NR／PC 次數同午餐／下午茶／晚飯約會，自動計分同紅黃綠；「PDCA」每季 13 週自動帶入活動分、寫每週焦點同年度 OKR；「四季人脈」將客拖去春／夏／秋／冬（或者喺客戶頁用「四季」選單揀），簽得就拖去最右「✍️ 已簽」，再撳「加入本月生意表」；「生意表」每月記客名、產品、AFYP、Revenue、佣金，同月目標比較（金額可以打 12000 或 1.2萬）；「我的看板」睇自己啲客；「＋ 新增客戶」開卡；撳卡入去逐頁填 RR／NR1／NR2／FNA／PC；拖拉卡片轉階段（手機長按再拖，或者喺客戶頁用「階段」選單）。只可以睇、改自己嘅客。 |
| **Ryan（主管）** | 「主管總覽」睇全組：每人每個階段幾多客、邊個客具備簽單條件；每人今週活動分（紅黃綠）同本月 AFYP／佣金 vs 目標；撳員工名睇佢嘅看板、四季人脈、活動分、PDCA 同生意表、撳客名睇詳情（唯讀）。「員工帳戶」開帳戶、停用／重新啟用、改名、重設密碼。「審計記錄」睇所有修改記錄。 |

**簽單條件：** RR 四格 ＋ NR2 四格全部剔晒，張卡自動變綠色「具備簽單條件」；未齊就顯示仲差邊幾格。

**停用員工：** 即時登入唔到、亦睇唔到任何客戶資料（就算佢部手機仲開住都冇用）。佢嘅客會保留，Ryan 仍然睇得到。

---

## 私隱保護（香港《個人資料（私隱）條例》）

- **加密：** 客戶姓名、年齡、性別、職業、婚姻狀況、所有表格內容，喺伺服器用 AES-256-GCM 加密後先存入資料庫；資料庫入面只係亂碼。傳輸用 HTTPS，Supabase 硬碟本身亦有加密。
- **權限控制（Row Level Security）：** 喺資料庫層面限制——員工淨係攞到自己嘅客；Ryan 只可以「睇」全部、唔可以改員工嘅客；未登入乜都攞唔到。就算有人繞過介面直接打 API 都一樣。
- **審計記錄：** 資料庫自動記低「邊個、幾時、改咗邊格」，包括階段變更前後；任何人（包括 Ryan）都改唔到、刪唔到。加密內容唔會抄入審計記錄。
- **唔收身份證號碼。**
- 冇開放自行註冊；帳戶只可由主管開設。

---

## 開發者資料

```
crm/
  app/                     Next.js 頁面（App Router）
    login/                 登入
    (app)/board/           員工看板
    (app)/clients/         新增客戶、客戶詳情、server actions
    (app)/admin/           主管總覽、員工看板、員工帳戶、審計記錄
    (app)/account/         改密碼
  components/              看板（@dnd-kit）、客戶表格、審計列表
  lib/stages.ts            五個階段表格欄位、簽單條件定義
  lib/crypto.ts            AES-256-GCM 欄位加密
  supabase/migrations/     資料庫結構 + RLS + 審計 trigger
  supabase/tests/          RLS 權限測試（可以直接喺 Supabase SQL Editor 行）
  tests/unit/              單元測試（vitest）
  tests/e2e/               端對端權限隔離測試（Playwright）
```

```bash
npm install
npm run lint        # TypeScript 檢查
npm test            # 單元測試
npx playwright test # 端對端（要測試用 Supabase + 行緊嘅 app，見 playwright.config.ts）
```

所有資料讀寫都喺伺服器用登入用戶嘅身份進行（受 RLS 限制）；`SUPABASE_SERVICE_ROLE_KEY` 只用喺「開／停員工帳戶」，而且一定先確認係管理員。
