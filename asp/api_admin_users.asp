<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：玩家名單
JsonHead
RequireAdmin
Dim rs, out, first
Set rs = Exec("SELECT * FROM OUsers ORDER BY Points DESC, ID", Null)
out = "" : first = True
Do While Not rs.EOF
  If Not first Then out = out & ","
  first = False
  out = out & UserJson(rs)
  rs.MoveNext
Loop
Response.Write "{""users"":[" & out & "]}"
%>
