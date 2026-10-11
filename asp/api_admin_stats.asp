<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 後台：儀表板數字
JsonHead
RequireAdmin
Dim rs, players, totalPoints, matches, finished, upcoming, picksN, wonN

Set rs = Exec("SELECT COUNT(*), SUM(Points) FROM OUsers WHERE IsAdmin=False", Null)
players = CLng(rs(0))
If IsNull(rs(1)) Then totalPoints = 0 Else totalPoints = CLng(rs(1))

Set rs = Exec("SELECT COUNT(*) FROM OMatches", Null)
matches = CLng(rs(0))
Set rs = Exec("SELECT COUNT(*) FROM OMatches WHERE MStatus='finished'", Null)
finished = CLng(rs(0))
Set rs = Exec("SELECT COUNT(*) FROM OMatches WHERE MStatus='upcoming'", Null)
upcoming = CLng(rs(0))
Set rs = Exec("SELECT COUNT(*) FROM OPicks", Null)
picksN = CLng(rs(0))
Set rs = Exec("SELECT COUNT(*) FROM OPicks WHERE PStatus='won'", Null)
wonN = CLng(rs(0))

Response.Write "{""stats"":{""players"":" & players & ",""totalPoints"":" & totalPoints & _
  ",""matches"":" & matches & ",""finished"":" & finished & ",""upcoming"":" & upcoming & _
  ",""picks"":" & picksN & ",""correctPicks"":" & wonN & "}}"
%>
