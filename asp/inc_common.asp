<%
' ============================================================
' 海洋 Ocean — Classic ASP 共用函數 (俾其他頁 include 用)
' 純積分估波遊戲：估中先加分，估錯唔扣分。
' 積分只係遊戲分數，唔可以買、唔可以換錢、唔涉及任何金錢。
' ============================================================
Const adVarWChar = 202
Const adInteger  = 3
Const adDouble   = 5
Const adDate     = 7
Const adBoolean  = 11
Const adParamInput = 1
Const adCmdText  = 1

Dim gConn

' ---------- 資料庫連接（Access .mdb，App_Data 入面） ----------
Function GetConn()
  If IsObject(gConn) Then
    Set GetConn = gConn
    Exit Function
  End If
  Dim c, p
  p = Server.MapPath("App_Data/ocean.mdb")
  Set c = Server.CreateObject("ADODB.Connection")
  On Error Resume Next
  c.Open "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" & p
  If Err.Number <> 0 Then
    Err.Clear
    c.Open "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" & p
  End If
  On Error Goto 0
  If c.State = 0 Then
    Response.CodePage = 65001
    Response.Charset = "utf-8"
    Response.Write "資料庫連接失敗：請先喺瀏覽器行一次 setup.asp 建立資料庫；如果已經行咗，請問吓 hosting 有冇 Access (ACE 或 Jet OLEDB) 支援，同埋 App_Data 資料夾有冇寫入權限。"
    Response.End
  End If
  Set gConn = c
  Set GetConn = c
End Function

' ---------- SQL（一定用 ? 參數，防 SQL injection） ----------
Function Exec(sql, params)
  Dim cmd, i
  Set cmd = Server.CreateObject("ADODB.Command")
  Set cmd.ActiveConnection = GetConn()
  cmd.CommandType = adCmdText
  cmd.CommandText = sql
  If IsArray(params) Then
    For i = 0 To UBound(params)
      cmd.Parameters.Append MakeParam(cmd, params(i))
    Next
  End If
  Set Exec = cmd.Execute
End Function

Function MakeParam(cmd, v)
  Dim p, sz
  Select Case VarType(v)
    Case vbString
      sz = Len(v) : If sz < 1 Then sz = 1
      Set p = cmd.CreateParameter(, adVarWChar, adParamInput, sz, v)
    Case vbDouble, vbSingle
      Set p = cmd.CreateParameter(, adDouble, adParamInput, , CDbl(v))
    Case vbDate
      Set p = cmd.CreateParameter(, adDate, adParamInput, , v)
    Case vbBoolean
      Set p = cmd.CreateParameter(, adBoolean, adParamInput, , v)
    Case Else
      Set p = cmd.CreateParameter(, adInteger, adParamInput, , CLng(v))
  End Select
  Set MakeParam = p
End Function

Function LastId()
  Dim rs
  Set rs = Exec("SELECT @@IDENTITY", Null)
  LastId = CLng(rs(0))
End Function

' ---------- JSON 輸出 ----------
Sub JsonHead()
  Response.CodePage = 65001
  Response.Charset = "utf-8"
  Response.ContentType = "application/json"
End Sub

Function JE(ByVal s)   ' JSON string escape
  If IsNull(s) Then JE = "" : Exit Function
  s = CStr(s)
  s = Replace(s, "\", "\\")
  s = Replace(s, """", "\""")
  s = Replace(s, vbCrLf, "\n")
  s = Replace(s, vbCr, "\n")
  s = Replace(s, vbLf, "\n")
  s = Replace(s, vbTab, "\t")
  JE = s
End Function

Function JN(ByVal v)   ' 數字轉 JSON（就算 server 地區設定用「,」做小數點都安全）
  If IsNull(v) Then JN = "0" : Exit Function
  If Trim("" & v) = "" Then JN = "0" : Exit Function
  JN = Replace(CStr(v), ",", ".")
End Function

Function JB(b)         ' boolean 轉 JSON
  If b Then JB = "true" Else JB = "false"
End Function

Sub Fail(status, msg)  ' 出錯：例 Fail "400 Bad Request", "訊息"
  JsonHead
  Response.Status = status
  Response.Write "{""error"":""" & JE(msg) & """}"
  Response.End
End Sub

' ---------- 表單讀值 ----------
Function FormS(k)
  FormS = Trim("" & Request.Form(k))
End Function

Function FormL(k)
  FormL = 0
  On Error Resume Next
  FormL = CLng(Request.Form(k))
  On Error Goto 0
End Function

Function FormD(k)
  FormD = 0
  On Error Resume Next
  FormD = CDbl(Replace("" & Request.Form(k), ",", "."))
  On Error Goto 0
End Function

Sub RequirePost()
  If Request.ServerVariables("REQUEST_METHOD") <> "POST" Then Fail "405 Method Not Allowed", "要用 POST"
End Sub

' ---------- 密碼雜湊（鹽 + SHA-256，經 .NET COM） ----------
Function SHA256Hex(ByVal s)
  Dim enc, sha, bytes, hb, i, r
  Set enc = Server.CreateObject("System.Text.UTF8Encoding")
  Set sha = Server.CreateObject("System.Security.Cryptography.SHA256Managed")
  bytes = enc.GetBytes_4(s)
  hb = sha.ComputeHash_2(bytes)
  r = ""
  For i = 1 To LenB(hb)
    r = r & Right("0" & Hex(AscB(MidB(hb, i, 1))), 2)
  Next
  SHA256Hex = LCase(r)
End Function

Function HashPw(pw, salt)
  HashPw = SHA256Hex(salt & ":" & pw & ":ocean")
End Function

Function NewSalt()
  Dim i, s
  Randomize
  s = ""
  For i = 1 To 32
    s = s & Mid("0123456789abcdef", Int(Rnd * 16) + 1, 1)
  Next
  NewSalt = s
End Function

' ---------- 登入狀態（用 ASP Session，唔使 token） ----------
Function UID()
  UID = 0
  On Error Resume Next
  UID = CLng(Session("uid"))
  On Error Goto 0
End Function

Sub RequireLogin()
  If UID() = 0 Then Fail "401 Unauthorized", "請先登入"
End Sub

Sub RequireAdmin()
  RequireLogin
  If Session("isAdmin") <> True Then Fail "403 Forbidden", "需要管理員權限"
End Sub

' ---------- 積分：估中先加分（賠率高＝難度高＝加多啲），估錯 0 ----------
Function PtsFor(ByVal odd)
  If IsNull(odd) Then odd = 1
  If odd <= 0 Then odd = 1
  PtsFor = Int(odd * 10 + 0.5)
End Function

' ---------- 設定（公告等） ----------
Function GetSetting(k)
  Dim rs
  Set rs = Exec("SELECT SVal FROM OSettings WHERE SKey=?", Array(k))
  If rs.EOF Then GetSetting = "" Else GetSetting = "" & rs(0)
End Function

Sub SetSetting(k, v)
  Dim rs
  Set rs = Exec("SELECT SKey FROM OSettings WHERE SKey=?", Array(k))
  If rs.EOF Then
    Call Exec("INSERT INTO OSettings (SKey, SVal) VALUES (?, ?)", Array(k, v))
  Else
    Call Exec("UPDATE OSettings SET SVal=? WHERE SKey=?", Array(v, k))
  End If
End Sub

' ---------- 使用者 JSON ----------
Function UserJson(rs)
  UserJson = "{""id"":" & JN(rs("ID")) & ",""username"":""" & JE(rs("Username")) & _
    """,""points"":" & JN(rs("Points")) & ",""correct"":" & JN(rs("CorrectN")) & _
    ",""played"":" & JN(rs("PlayedN")) & ",""isAdmin"":" & JB(CBool(rs("IsAdmin"))) & "}"
End Function
%>
