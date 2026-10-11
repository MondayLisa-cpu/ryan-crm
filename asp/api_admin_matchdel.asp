<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：刪賽事（連埋嗰場嘅估注一齊刪）
RequirePost
JsonHead
RequireAdmin
Dim id
id = FormL("id")
If id <= 0 Then Fail "400 Bad Request", "冇話刪邊場"
Call Exec("DELETE FROM OPicks WHERE MatchID=?", Array(id))
Call Exec("DELETE FROM OMatches WHERE ID=?", Array(id))
Response.Write "{""ok"":true}"
%>
