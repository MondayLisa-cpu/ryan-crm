<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' ============================================================
' 海洋 Ocean — 一次性安裝頁
' 行一次就建立 App_Data/ocean.mdb（資料表 + 管理員 + 示範賽事）
' ⚠️ 裝完記得刪咗呢個 setup.asp！
' ============================================================
Response.CodePage = 65001
Response.Charset = "utf-8"

Dim fso, dataDir, dbPath, msg, adminPw
Set fso = Server.CreateObject("Scripting.FileSystemObject")
dataDir = Server.MapPath("App_Data")
dbPath  = Server.MapPath("App_Data/ocean.mdb")
msg = ""

If Request.ServerVariables("REQUEST_METHOD") = "POST" Then
  If fso.FileExists(dbPath) Then
    msg = "已經有資料庫（App_Data/ocean.mdb），唔使再裝。如果想由頭嚟過，先喺 hosting 度刪咗個 mdb 檔先。"
  Else
    adminPw = "" & Request.Form("adminpw")
    If Len(adminPw) < 6 Then
      msg = "管理員密碼最少 6 個字，請返上一頁再試。"
    Else
      If Not fso.FolderExists(dataDir) Then fso.CreateFolder(dataDir)

      ' --- 建立 mdb（先試 Jet，唔得就試 ACE） ---
      Dim cat, created
      created = False
      Set cat = Server.CreateObject("ADOX.Catalog")
      On Error Resume Next
      cat.Create "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & dbPath
      If Err.Number <> 0 Then
        Err.Clear
        cat.Create "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" & dbPath
      End If
      On Error Goto 0
      If fso.FileExists(dbPath) Then created = True

      If Not created Then
        msg = "建立唔到資料庫檔。請問吓 hosting：(1) 有冇 Access 資料庫 (Jet / ACE OLEDB) 支援？(2) App_Data 資料夾有冇寫入權限？（64-bit 環境可能要開 32-bit application pool 或裝 ACE driver）"
      Else
        ' --- 建表 ---
        Dim c
        Set c = GetConn()
        c.Execute "CREATE TABLE OUsers (ID AUTOINCREMENT PRIMARY KEY, Username TEXT(50), Salt TEXT(64), PwHash TEXT(64), Points LONG, CorrectN LONG, PlayedN LONG, IsAdmin YESNO, CreatedAt DATETIME)"
        c.Execute "CREATE TABLE OMatches (ID AUTOINCREMENT PRIMARY KEY, League TEXT(100), MatchTime TEXT(60), HomeN TEXT(100), HomeF TEXT(20), AwayN TEXT(100), AwayF TEXT(20), OddH DOUBLE, OddD DOUBLE, OddA DOUBLE, MStatus TEXT(20), ResultSel TEXT(10), HScore TEXT(10), AScore TEXT(10))"
        c.Execute "CREATE TABLE OPicks (ID AUTOINCREMENT PRIMARY KEY, UserID LONG, MatchID LONG, Sel TEXT(10), Odd DOUBLE, PStatus TEXT(10), Earned LONG, CreatedAt DATETIME)"
        c.Execute "CREATE TABLE OSettings (SKey TEXT(50) NOT NULL PRIMARY KEY, SVal MEMO)"

        ' --- 種子資料 ---
        Dim salt
        salt = NewSalt()
        Call Exec("INSERT INTO OUsers (Username, Salt, PwHash, Points, CorrectN, PlayedN, IsAdmin, CreatedAt) VALUES (?,?,?,0,0,0,?,?)", _
          Array("admin", salt, HashPw(adminPw, salt), True, Now()))
        SetSetting "announcement", "歡迎嚟到 海洋 🌊 估中邊隊贏就加分，估錯唔扣，安心玩！"

        Call Exec("INSERT INTO OMatches (League, MatchTime, HomeN, HomeF, AwayN, AwayF, OddH, OddD, OddA, MStatus, ResultSel, HScore, AScore) VALUES (?,?,?,?,?,?,?,?,?,'upcoming','','-','-')", Array("英超", "稍後開賽", "利物浦", "🔴", "阿仙奴", "🔵", 1.85, 3.4, 4.2))
        Call Exec("INSERT INTO OMatches (League, MatchTime, HomeN, HomeF, AwayN, AwayF, OddH, OddD, OddA, MStatus, ResultSel, HScore, AScore) VALUES (?,?,?,?,?,?,?,?,?,'upcoming','','-','-')", Array("西甲", "稍後開賽", "巴塞隆拿", "🔵", "皇家馬德里", "⚪", 2.45, 3.3, 2.75))
        Call Exec("INSERT INTO OMatches (League, MatchTime, HomeN, HomeF, AwayN, AwayF, OddH, OddD, OddA, MStatus, ResultSel, HScore, AScore) VALUES (?,?,?,?,?,?,?,?,?,'upcoming','','-','-')", Array("意甲", "稍後開賽", "國際米蘭", "🔵", "祖雲達斯", "⚫", 2.1, 3.2, 3.6))
        Call Exec("INSERT INTO OMatches (League, MatchTime, HomeN, HomeF, AwayN, AwayF, OddH, OddD, OddA, MStatus, ResultSel, HScore, AScore) VALUES (?,?,?,?,?,?,?,?,?,'upcoming','','-','-')", Array("德甲", "稍後開賽", "拜仁慕尼黑", "🔴", "多蒙特", "🟡", 1.65, 3.8, 4.9))

        msg = "OK"
      End If
    End If
  End If
End If
%>
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>海洋 · 安裝</title>
<style>
  body{font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:#051426;color:#eef5fb;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .box{max-width:460px;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:28px;}
  h1{font-size:20px;margin:0 0 6px;letter-spacing:.2em;}
  p{font-size:13.5px;line-height:1.7;color:#9db4c7;}
  b{color:#e7c584;}
  input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(2,12,24,.5);color:#fff;font-size:15px;outline:none;margin:8px 0 14px;}
  button{width:100%;padding:13px;border:none;border-radius:11px;font-size:15px;font-weight:700;background:linear-gradient(180deg,#f4dfae,#c89b52);color:#2a1d07;cursor:pointer;}
  .ok{color:#3ecf9a;} .warn{color:#e78d8d;}
  code{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:5px;font-size:12.5px;}
</style>
</head>
<body>
<div class="box">
  <h1>🌊 海洋 · 安裝</h1>
  <% If msg = "OK" Then %>
    <p class="ok"><b>裝好喇！</b>資料庫已經建立，仲加咗 4 場示範賽事。</p>
    <p>
      1. 管理員帳號：<b>admin</b>（密碼＝你啱啱設定嗰個）<br>
      2. 玩家頁：<code>default.asp</code>　後台：<code>admin.asp</code><br>
      3. ⚠️ <b>而家即刻刪咗 setup.asp 呢個檔</b>，唔好留喺 server 度。
    </p>
  <% ElseIf msg <> "" Then %>
    <p class="warn"><%= msg %></p>
    <p><a href="setup.asp" style="color:#e7c584">← 返回</a></p>
  <% Else %>
    <p>撳一下就會喺 <code>App_Data</code> 建立 Access 資料庫（資料表＋管理員＋示範賽事）。</p>
    <form method="post" action="setup.asp">
      <label style="font-size:12px;color:#e7c584;letter-spacing:.1em;">設定管理員密碼（最少 6 個字）</label>
      <input type="password" name="adminpw" placeholder="唔好用 admin123">
      <button type="submit">建立資料庫</button>
    </form>
    <p style="margin-top:14px">積分純遊戲用，唔可以買、唔可以換錢。裝完記得刪咗呢頁。</p>
  <% End If %>
</div>
</body>
</html>
