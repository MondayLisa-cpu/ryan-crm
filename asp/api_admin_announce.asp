<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：更新公告
RequirePost
JsonHead
RequireAdmin
SetSetting "announcement", "" & Request.Form("text")
Response.Write "{""ok"":true}"
%>
