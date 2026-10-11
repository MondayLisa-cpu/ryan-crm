============================================================
海洋 Ocean — Classic ASP 版
純積分估波遊戲：估中先加分，估錯唔扣分。
積分只係遊戲分數，唔可以買、唔可以換錢、唔涉及任何金錢。
============================================================

【呢個係乜】
同 Node 版功能一樣嘅 ASP 版本，可以擺上一般 Windows (IIS) ASP hosting：
  - default.asp        玩家頁（註冊／登入／估波／排行榜／我）
  - admin.asp          後台（儀表板／加賽事／開賽果自動加分／公告／玩家）
  - setup.asp          一次性安裝頁（建立資料庫；裝完要刪！）
  - inc_common.asp     共用函數（資料庫／密碼／JSON）
  - api_*.asp          API（前端 fetch 用）
  - App_Data/ocean.mdb 資料庫（行 setup.asp 之後先會有）

【hosting 要求】
  1. Windows hosting，支援 Classic ASP
  2. 支援 Access 資料庫（Jet 或 ACE OLEDB；64-bit 環境可能要開
     32-bit application pool，或者叫 hosting 裝 ACE driver）
  3. App_Data 資料夾要有寫入權限（web root 上載完通常要喺
     control panel 度俾 write permission）
  4. 密碼雜湊用 .NET COM（SHA-256），一般 Windows server 都有

【安裝步驟】
  1. 將成個資料夾上載去你個 site（例如 wwwroot 或者一個子目錄）
  2. 瀏覽器開  setup.asp  → 設定管理員密碼 → 建立資料庫
  3. ⚠️ 裝完即刻刪咗 setup.asp
  4. 玩家頁 = default.asp（IIS 預設文件通常已經係佢，開網址就得）
     後台   = admin.asp（帳號 admin ＋ 你設定嘅密碼）
  5. 建議開 HTTPS（hosting control panel 通常有免費 SSL）

【同 Node 版嘅分別】
  - 登入用 ASP Session（cookie），唔使 token
  - 資料擺喺 Access（App_Data/ocean.mdb），想備份就下載呢個檔
  - 自動匯入真實賽程（TheSportsDB）暫時未有：後台手動加賽事
    （想加自動匯入可以之後補）

【遊戲規則（同 Node 版一樣）】
  - 玩家自己註冊，一人一場估一次
  - 估中：加 round(賠率 × 10) 分（冷門難估啲，所以加多啲）
  - 估錯：0 分，唔會扣
  - 賠率淨係用嚟計難度＋顯示，唔涉及押注／派彩／任何金錢
============================================================
