<%@ Language=VBScript CodePage=65001 %>
<!--#include file="inc_common.asp"-->
<%
' 全部賽事 + 公告（唔使登入都睇到）
JsonHead
Dim rs, out, first, resPart
Set rs = Exec("SELECT * FROM OMatches ORDER BY ID", Null)
out = "" : first = True
Do While Not rs.EOF
  If Not first Then out = out & ","
  first = False
  If Trim("" & rs("ResultSel")) = "" Then
    resPart = "null"
  Else
    resPart = """" & JE(rs("ResultSel")) & """"
  End If
  out = out & "{""id"":" & JN(rs("ID")) & _
    ",""league"":""" & JE(rs("League")) & _
    """,""time"":""" & JE(rs("MatchTime")) & _
    """,""home"":{""n"":""" & JE(rs("HomeN")) & """,""f"":""" & JE(rs("HomeF")) & _
    """},""away"":{""n"":""" & JE(rs("AwayN")) & """,""f"":""" & JE(rs("AwayF")) & _
    """},""o"":{""home"":" & JN(rs("OddH")) & ",""draw"":" & JN(rs("OddD")) & ",""away"":" & JN(rs("OddA")) & _
    "},""status"":""" & JE(rs("MStatus")) & _
    """,""result"":" & resPart & _
    ",""hs"":""" & JE(rs("HScore")) & """,""as"":""" & JE(rs("AScore")) & """}"
  rs.MoveNext
Loop
Response.Write "{""matches"":[" & out & "],""announcement"":""" & JE(GetSetting("announcement")) & """}"
%>
