<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：開賽果 → 自動幫估中嘅玩家加分（gain-only，估錯唔扣）
RequirePost
JsonHead
RequireAdmin
Dim matchId, result, rs
matchId = FormL("matchId")
result = FormS("result")
If result <> "home" And result <> "draw" And result <> "away" Then Fail "400 Bad Request", "賽果要係 home / draw / away"

Set rs = Exec("SELECT * FROM OMatches WHERE ID=?", Array(matchId))
If rs.EOF Then Fail "404 Not Found", "搵唔到呢場賽事"
If ("" & rs("MStatus")) = "finished" Then Fail "400 Bad Request", "呢場已經開咗賽果"

Call Exec("UPDATE OMatches SET ResultSel=?, MStatus='finished' WHERE ID=?", Array(result, matchId))

' 先讀晒所有未結算嘅估注入 array，close 咗個 recordset 先逐個更新（Access 唔鍾意邊讀邊寫）
' （VBScript 嘅 ReDim Preserve 只可以擴最後一個維度，所以行數放最後）
Dim picks(), cnt, i
cnt = 0
ReDim picks(3, 200)
Set rs = Exec("SELECT ID, UserID, Sel, Odd FROM OPicks WHERE MatchID=? AND PStatus='open'", Array(matchId))
Do While Not rs.EOF
  If cnt > UBound(picks, 2) Then ReDim Preserve picks(3, cnt + 200)
  picks(0, cnt) = CLng(rs("ID"))
  picks(1, cnt) = CLng(rs("UserID"))
  picks(2, cnt) = "" & rs("Sel")
  picks(3, cnt) = CDbl(rs("Odd"))
  cnt = cnt + 1
  rs.MoveNext
Loop
rs.Close

Dim earned
For i = 0 To cnt - 1
  If picks(2, i) = result Then
    earned = PtsFor(picks(3, i))
    Call Exec("UPDATE OPicks SET PStatus='won', Earned=? WHERE ID=?", Array(earned, picks(0, i)))
    Call Exec("UPDATE OUsers SET Points=Points+?, CorrectN=CorrectN+1, PlayedN=PlayedN+1 WHERE ID=?", Array(earned, picks(1, i)))
  Else
    Call Exec("UPDATE OPicks SET PStatus='lost', Earned=0 WHERE ID=?", Array(picks(0, i)))
    Call Exec("UPDATE OUsers SET PlayedN=PlayedN+1 WHERE ID=?", Array(picks(1, i)))
  End If
Next

Response.Write "{""ok"":true,""settled"":" & cnt & "}"
%>
