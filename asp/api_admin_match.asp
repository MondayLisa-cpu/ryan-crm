<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：加／改賽事（純遊戲管理，冇錢、冇落注戶口）
RequirePost
JsonHead
RequireAdmin
Dim id, league, mtime, homeN, homeF, awayN, awayF, oH, oD, oA
id = FormL("id")
league = FormS("league") : If league = "" Then league = "賽事"
mtime  = FormS("time")   : If mtime  = "" Then mtime  = "稍後開賽"
homeN  = FormS("homeN")  : If homeN  = "" Then homeN  = "主隊"
awayN  = FormS("awayN")  : If awayN  = "" Then awayN  = "客隊"
homeF  = FormS("homeF")  : If homeF  = "" Then homeF  = "⚽"
awayF  = FormS("awayF")  : If awayF  = "" Then awayF  = "⚽"
oH = FormD("oH") : If oH <= 1 Then oH = 2#
oD = FormD("oD") : If oD <= 1 Then oD = 3.2
oA = FormD("oA") : If oA <= 1 Then oA = 3.4

If id > 0 Then
  Dim rs
  Set rs = Exec("SELECT ID FROM OMatches WHERE ID=?", Array(id))
  If rs.EOF Then Fail "404 Not Found", "搵唔到呢場賽事"
  Call Exec("UPDATE OMatches SET League=?, MatchTime=?, HomeN=?, HomeF=?, AwayN=?, AwayF=?, OddH=?, OddD=?, OddA=? WHERE ID=?", _
    Array(league, mtime, homeN, homeF, awayN, awayF, oH, oD, oA, id))
Else
  Call Exec("INSERT INTO OMatches (League, MatchTime, HomeN, HomeF, AwayN, AwayF, OddH, OddD, OddA, MStatus, ResultSel, HScore, AScore) VALUES (?,?,?,?,?,?,?,?,?,'upcoming','','-','-')", _
    Array(league, mtime, homeN, homeF, awayN, awayF, oH, oD, oA))
End If
Response.Write "{""ok"":true}"
%>
