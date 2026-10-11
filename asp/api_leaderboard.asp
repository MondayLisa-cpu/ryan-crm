<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 排行榜（頭 50 名，唔計管理員）
JsonHead
Dim rs, out, first
Set rs = Exec("SELECT TOP 50 Username, Points, CorrectN, PlayedN FROM OUsers WHERE IsAdmin=False ORDER BY Points DESC, ID", Null)
out = "" : first = True
Do While Not rs.EOF
  If Not first Then out = out & ","
  first = False
  out = out & "{""username"":""" & JE(rs("Username")) & """,""points"":" & JN(rs("Points")) & _
    ",""correct"":" & JN(rs("CorrectN")) & ",""played"":" & JN(rs("PlayedN")) & "}"
  rs.MoveNext
Loop
Response.Write "{""leaderboard"":[" & out & "]}"
%>
