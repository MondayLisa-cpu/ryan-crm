<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 估波：一人一場估一次，估中先加分
RequirePost
JsonHead
RequireLogin
Dim matchId, sel, rs, odd
matchId = FormL("matchId")
sel = FormS("sel")
If sel <> "home" And sel <> "draw" And sel <> "away" Then Fail "400 Bad Request", "估法唔啱"

Set rs = Exec("SELECT * FROM OMatches WHERE ID=?", Array(matchId))
If rs.EOF Then Fail "404 Not Found", "搵唔到呢場賽事"
If ("" & rs("MStatus")) = "finished" Then Fail "400 Bad Request", "呢場已經完咗"

If sel = "home" Then
  odd = CDbl(rs("OddH"))
ElseIf sel = "draw" Then
  odd = CDbl(rs("OddD"))
Else
  odd = CDbl(rs("OddA"))
End If

Dim ex
Set ex = Exec("SELECT ID FROM OPicks WHERE UserID=? AND MatchID=?", Array(UID(), matchId))
If Not ex.EOF Then Fail "400 Bad Request", "你已經估咗呢場"

Call Exec("INSERT INTO OPicks (UserID, MatchID, Sel, Odd, PStatus, Earned, CreatedAt) VALUES (?,?,?,?,'open',0,?)", _
  Array(UID(), matchId, sel, odd, Now()))

Response.Write "{""ok"":true,""willEarn"":" & PtsFor(odd) & "}"
%>
