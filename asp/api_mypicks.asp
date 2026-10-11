<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 我估過嘅場次
JsonHead
RequireLogin
Dim rs, out, first
Set rs = Exec("SELECT * FROM OPicks WHERE UserID=? ORDER BY ID DESC", Array(UID()))
out = "" : first = True
Do While Not rs.EOF
  If Not first Then out = out & ","
  first = False
  out = out & "{""matchId"":" & JN(rs("MatchID")) & ",""sel"":""" & JE(rs("Sel")) & _
    """,""odd"":" & JN(rs("Odd")) & ",""status"":""" & JE(rs("PStatus")) & _
    """,""earned"":" & JN(rs("Earned")) & "}"
  rs.MoveNext
Loop
Response.Write "{""picks"":[" & out & "]}"
%>
