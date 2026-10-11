<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 而家登入緊嘅係邊個
JsonHead
RequireLogin
Dim rs
Set rs = Exec("SELECT * FROM OUsers WHERE ID=?", Array(UID()))
If rs.EOF Then
  Session.Abandon
  Fail "401 Unauthorized", "請先登入"
End If
Response.Write "{""user"":" & UserJson(rs) & "}"
%>
