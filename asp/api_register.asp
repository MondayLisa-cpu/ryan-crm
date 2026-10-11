<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 玩家自己註冊
RequirePost
JsonHead
Dim un, pw, rs, salt, newId
un = FormS("username")
pw = "" & Request.Form("password")
If un = "" Or pw = "" Then Fail "400 Bad Request", "請填帳號同密碼"
If Len(un) > 30 Then Fail "400 Bad Request", "帳號太長（最多 30 個字）"

Set rs = Exec("SELECT ID FROM OUsers WHERE UCase(Username)=UCase(?)", Array(un))
If Not rs.EOF Then Fail "400 Bad Request", "呢個帳號已經有人用"

salt = NewSalt()
Call Exec("INSERT INTO OUsers (Username, Salt, PwHash, Points, CorrectN, PlayedN, IsAdmin, CreatedAt) VALUES (?,?,?,0,0,0,?,?)", _
  Array(un, salt, HashPw(pw, salt), False, Now()))
newId = LastId()

Session("uid") = newId
Session("uname") = un
Session("isAdmin") = False

Response.Write "{""user"":{""id"":" & newId & ",""username"":""" & JE(un) & """,""points"":0,""correct"":0,""played"":0,""isAdmin"":false}}"
%>
