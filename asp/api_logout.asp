<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 登出
JsonHead
Session.Abandon
Response.Write "{""ok"":true}"
%>
