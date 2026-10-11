<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 登入
RequirePost
JsonHead
Dim un, pw, rs
un = FormS("username")
pw = "" & Request.Form("password")
If un = "" Or pw = "" Then Fail "400 Bad Request", "請填帳號同密碼"

Set rs = Exec("SELECT * FROM OUsers WHERE UCase(Username)=UCase(?)", Array(un))
If rs.EOF Then Fail "400 Bad Request", "帳號或密碼唔啱"
If HashPw(pw, "" & rs("Salt")) <> ("" & rs("PwHash")) Then Fail "400 Bad Request", "帳號或密碼唔啱"

Session("uid") = CLng(rs("ID"))
Session("uname") = "" & rs("Username")
Session("isAdmin") = CBool(rs("IsAdmin"))

Response.Write "{""user"":" & UserJson(rs) & "}"
%>
