<%@ Language=VBScript CodePage=65001 %>
<% Response.CodePage = 65001 : Response.Charset = "utf-8" %>
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#051426">
<title>海洋 · 後台管理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@700;900&display=swap" rel="stylesheet">
<style>
  :root{
    --gold:#e7c584; --gold-2:#f6e3b4; --gold-3:#c89b52;
    --ink:#eef5fb; --muted:#9db4c7; --faint:#6d8ba3;
    --line:rgba(255,255,255,.09); --line-soft:rgba(255,255,255,.05);
    --good:#3ecf9a; --bad:#e78d8d;
    --serif:'Noto Serif TC',serif;
    --sans:'Noto Sans TC',-apple-system,'PingFang TC',sans-serif;
    --num:'Cormorant Garamond','Noto Serif TC',serif;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:var(--sans);color:var(--ink);min-height:100vh;
    background:
      radial-gradient(90% 55% at 72% -12%, rgba(31,111,176,.30), transparent 62%),
      radial-gradient(60% 42% at 12% 2%, rgba(64,160,201,.16), transparent 58%),
      linear-gradient(180deg,#08203a 0%,#051426 46%,#02070f 100%);
    background-attachment:fixed;}
  .wrap{max-width:960px;margin:0 auto;padding:24px 18px 70px;}
  h1{font-family:var(--serif);font-size:21px;letter-spacing:.3em;margin:0 0 4px;background:linear-gradient(180deg,#fff,#c9e2f2);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .sub{color:var(--gold);font-size:11.5px;letter-spacing:.14em;margin-bottom:18px;}
  .card{background:linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.02) 55%),rgba(9,26,46,.55);border:1px solid var(--line);border-radius:18px;padding:18px;margin:14px 0;backdrop-filter:blur(18px);box-shadow:0 20px 50px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.07);}
  h2{font-size:13px;color:var(--gold);margin:0 0 14px;letter-spacing:.2em;font-weight:700;}
  label{display:block;font-size:11px;color:var(--gold);letter-spacing:.14em;margin:8px 2px 5px;opacity:.85;}
  input,select{width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:rgba(2,12,24,.5);color:#fff;font-size:14px;outline:none;font-family:var(--sans);}
  input:focus,select:focus{border-color:rgba(231,197,132,.65);}
  .btn{padding:10px 18px;border:none;border-radius:11px;font-size:14px;font-weight:700;letter-spacing:.06em;background:linear-gradient(180deg,#f4dfae,#dfba74 55%,#c89b52);color:#2a1d07;cursor:pointer;box-shadow:0 8px 20px rgba(200,155,82,.25);}
  .btn:hover{filter:brightness(1.05);}
  .btn:active{transform:translateY(1px);}
  .btn.sm{padding:6px 12px;font-size:12.5px;}
  .btn.g{background:linear-gradient(180deg,#5fe0b0,#25a377);color:#052015;box-shadow:0 8px 20px rgba(37,163,119,.25);}
  .btn.ghost{background:transparent;border:1px solid var(--line);box-shadow:none;color:var(--ink);font-weight:600;}
  .btn.red{background:linear-gradient(180deg,#ef9a9a,#c74e4e);color:#2b0a0a;box-shadow:0 8px 20px rgba(199,78,78,.25);}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:end;}
  .row > div{flex:1;min-width:90px;}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr);}}
  .stat{background:rgba(4,16,30,.45);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center;}
  .stat .v{font-family:var(--num);font-variant-numeric:lining-nums;font-size:26px;font-weight:700;color:var(--gold);}
  .stat .k{font-size:11px;color:var(--muted);margin-top:3px;letter-spacing:.08em;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th,td{text-align:left;padding:9px 7px;border-bottom:1px solid var(--line-soft);vertical-align:middle;}
  th{color:var(--gold);font-weight:600;font-size:11.5px;letter-spacing:.1em;}
  .tag{display:inline-block;padding:2px 8px;border-radius:7px;font-size:11px;}
  .tag.up{background:rgba(63,167,221,.16);color:#9fd6f2;}
  .tag.fin{background:rgba(62,207,154,.16);color:var(--good);}
  .tag.live{background:rgba(228,106,106,.16);color:var(--bad);}
  .err{color:#ff9a9a;font-size:12px;min-height:15px;}
  .hidden{display:none;}
  .muted{color:var(--faint);font-size:12px;}
  .login{max-width:380px;margin:12vh auto;}
  .scroll{overflow-x:auto;}
</style>
</head>
<body>
<div class="wrap">
  <h1>海洋 · 後台</h1><div class="sub">純遊戲管理 · 賽事／賽果／玩家（唔涉及任何金錢）</div>

  <div id="login" class="card login">
    <h2>管理員登入</h2>
    <label>帳號</label><input id="au" value="admin">
    <label>密碼</label><input id="ap" type="password">
    <div style="margin-top:16px"><button class="btn" onclick="login()">登入</button></div>
    <div class="err" id="le"></div>
  </div>

  <div id="panel" class="hidden">
    <div class="card"><h2>📊 儀表板</h2><div class="stats" id="stats"></div></div>

    <div class="card"><h2>➕ 加賽事</h2>
      <div class="row">
        <div><label>聯賽</label><input id="mLeague" placeholder="英超"></div>
        <div><label>時間</label><input id="mTime" placeholder="今晚 22:00"></div>
      </div>
      <div class="row">
        <div><label>主隊</label><input id="mHome" placeholder="利物浦"></div>
        <div style="max-width:70px;flex:0 0 70px"><label>旗</label><input id="mHomeF" placeholder="🔴"></div>
        <div><label>客隊</label><input id="mAway" placeholder="阿仙奴"></div>
        <div style="max-width:70px;flex:0 0 70px"><label>旗</label><input id="mAwayF" placeholder="🔵"></div>
      </div>
      <div class="row">
        <div><label>主勝賠率</label><input id="oH" type="number" step="0.01" value="2.00"></div>
        <div><label>和賠率</label><input id="oD" type="number" step="0.01" value="3.20"></div>
        <div><label>客勝賠率</label><input id="oA" type="number" step="0.01" value="3.40"></div>
      </div>
      <div style="margin-top:14px"><button class="btn" onclick="addMatch()">加賽事</button></div>
      <div class="err" id="me2"></div>
      <div class="muted" style="margin-top:6px">賠率淨係用嚟計積分難度（估啱冷門加多啲分）＋顯示，唔涉及押注／派彩。ASP 版賽事手動加；自動匯入真實賽程可以下一步加。</div>
    </div>

    <div class="card"><h2>⚽ 賽事管理</h2><div class="scroll"><table id="mtbl"></table></div></div>

    <div class="card"><h2>📣 公告</h2>
      <input id="ann" placeholder="打段公告俾玩家睇">
      <div style="margin-top:12px"><button class="btn sm" onclick="saveAnn()">更新公告</button></div>
    </div>

    <div class="card"><h2>👥 玩家</h2><div class="scroll"><table id="utbl"></table></div></div>
    <div style="margin-top:10px"><button class="btn ghost sm" onclick="logout()">登出</button></div>
  </div>
</div>

<script>
/* ASP 版：session cookie 登入，API 係 api_*.asp，POST 用表單格式 */
async function api(p, data) {
  const o = data ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() } : {};
  const r = await fetch(p, o); const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('錯誤 ' + r.status)); return j;
}
async function login() {
  try {
    const j = await api('api_login.asp', { username: au.value.trim(), password: ap.value });
    if (!j.user.isAdmin) { le.textContent = '呢個帳號唔係管理員'; try { await api('api_logout.asp', { bye: 1 }); } catch (e) {} return; }
    show();
  } catch (e) { le.textContent = e.message; }
}
async function logout() { try { await api('api_logout.asp', { bye: 1 }); } catch (e) {} location.reload(); }
function show() { document.getElementById('login').classList.add('hidden'); document.getElementById('panel').classList.remove('hidden'); loadAll(); }

async function loadAll() { await Promise.all([loadStats(), loadMatches(), loadUsers(), loadAnn()]); }
async function loadStats() {
  const { stats: s } = await api('api_admin_stats.asp');
  document.getElementById('stats').innerHTML = [
    ['玩家', s.players], ['總積分', s.totalPoints], ['賽事', s.matches], ['已完場', s.finished],
    ['待開賽', s.upcoming], ['總估注', s.picks], ['估中次數', s.correctPicks], ['命中%', s.picks ? Math.round(s.correctPicks / s.picks * 100) + '%' : '—']
  ].map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
}
async function loadAnn() { try { const { announcement } = await api('api_matches.asp'); ann.value = announcement || ''; } catch (e) {} }
async function loadMatches() {
  const { matches } = await api('api_matches.asp');
  const rows = matches.map(m => {
    const tag = m.status === 'finished' ? '<span class="tag fin">完場</span>' : m.status === 'live' ? '<span class="tag live">進行中</span>' : '<span class="tag up">待開賽</span>';
    const resTxt = m.result ? (m.result === 'home' ? m.home.n : m.result === 'draw' ? '和' : m.away.n) : '';
    const ctrl = m.status === 'finished' ? `賽果：<b style="color:var(--good)">${resTxt}</b>` :
      `<button class="btn sm g" onclick="setResult(${m.id},'home')">主勝</button>
       <button class="btn sm g" onclick="setResult(${m.id},'draw')">和</button>
       <button class="btn sm g" onclick="setResult(${m.id},'away')">客勝</button>`;
    return `<tr><td>${tag}</td><td><b>${m.home.n}</b> ${m.home.f} vs ${m.away.f} <b>${m.away.n}</b><div class="muted">${m.league} · ${m.time}</div></td>
      <td class="muted">${(+m.o.home).toFixed(2)} / ${(+m.o.draw).toFixed(2)} / ${(+m.o.away).toFixed(2)}</td>
      <td>${ctrl}</td><td><button class="btn sm red" onclick="delMatch(${m.id})">刪</button></td></tr>`;
  }).join('');
  mtbl.innerHTML = `<tr><th>狀態</th><th>賽事</th><th>賠率(主/和/客)</th><th>入賽果 → 自動加分</th><th></th></tr>${rows || '<tr><td colspan=5 class=muted>未有賽事</td></tr>'}`;
}
async function loadUsers() {
  const { users } = await api('api_admin_users.asp');
  const rows = users.filter(u => !u.isAdmin).sort((a, b) => b.points - a.points).map(u =>
    `<tr><td><b>${u.username}</b></td><td>${u.points} 分</td><td class="muted">${u.played ? Math.round(u.correct / u.played * 100) + '% (' + u.correct + '/' + u.played + ')' : '—'}</td></tr>`).join('');
  utbl.innerHTML = `<tr><th>玩家</th><th>積分</th><th>估中率</th></tr>${rows || '<tr><td colspan=3 class=muted>未有玩家</td></tr>'}`;
}
async function addMatch() {
  try {
    await api('api_admin_match.asp', {
      league: mLeague.value, time: mTime.value,
      homeN: mHome.value, homeF: mHomeF.value, awayN: mAway.value, awayF: mAwayF.value,
      oH: oH.value, oD: oD.value, oA: oA.value });
    mHome.value = mAway.value = mHomeF.value = mAwayF.value = ''; me2.textContent = '';
    await loadMatches(); await loadStats();
  } catch (e) { me2.textContent = e.message; }
}
async function setResult(matchId, result) { if (!confirm('確定開賽果？開咗會即刻幫估中嘅玩家加分，開咗冇得改。')) return; try { await api('api_admin_result.asp', { matchId, result }); } catch (e) { alert(e.message); } await loadAll(); }
async function delMatch(id) { if (!confirm('刪除呢場？連埋玩家喺呢場嘅估注一齊刪。')) return; await api('api_admin_matchdel.asp', { id }); await loadMatches(); await loadStats(); }
async function saveAnn() { await api('api_admin_announce.asp', { text: ann.value }); alert('公告更新咗'); }

/* boot：有 admin session 就直接入 */
(async () => {
  try { const me = await api('api_me.asp'); if (me.user.isAdmin) show(); } catch (e) {}
})();
</script>
</body>
</html>
