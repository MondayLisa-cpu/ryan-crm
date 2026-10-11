<%@ Language=VBScript CodePage=65001 %>
<% Response.CodePage = 65001 : Response.Charset = "utf-8" %>
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#051426">
<title>海洋 · 估波遊戲</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  :root{
    --abyss:#02070f; --deep:#051426; --ocean:#0a2542; --ocean2:#123a61;
    --gold:#e7c584; --gold-2:#f6e3b4; --gold-3:#c89b52; --gold-deep:#8f6a2e;
    --ink:#eef5fb; --muted:#9db4c7; --faint:#6d8ba3;
    --line:rgba(255,255,255,.09); --line-soft:rgba(255,255,255,.05);
    --good:#3ecf9a; --bad:#e78d8d;
    --serif:'Noto Serif TC','Songti TC',serif;
    --sans:'Noto Sans TC',-apple-system,'PingFang TC','Heiti TC',sans-serif;
    --num:'Cormorant Garamond','Noto Serif TC',serif;
  }
  .pts span,.p-o,.lb-pts,.rk{font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{margin:0;height:100%;}
  body{
    font-family:var(--sans);color:var(--ink);min-height:100dvh;overflow-x:hidden;
    background:
      radial-gradient(90% 55% at 72% -12%, rgba(31,111,176,.30), transparent 62%),
      radial-gradient(60% 42% at 12% 2%, rgba(64,160,201,.16), transparent 58%),
      linear-gradient(180deg,#08203a 0%,#051426 46%,#02070f 100%);
    background-attachment:fixed;
  }
  .bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
  .orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;}
  .orb.a{width:420px;height:420px;left:-140px;top:-120px;background:radial-gradient(circle,rgba(38,124,190,.55),transparent 70%);animation:drift 22s ease-in-out infinite alternate;}
  .orb.b{width:360px;height:360px;right:-120px;top:22%;background:radial-gradient(circle,rgba(20,90,150,.45),transparent 70%);animation:drift 26s ease-in-out infinite alternate-reverse;}
  .orb.c{width:300px;height:300px;left:30%;bottom:-140px;background:radial-gradient(circle,rgba(231,197,132,.14),transparent 70%);animation:drift 30s ease-in-out infinite alternate;}
  @keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(40px,26px,0) scale(1.12)}}
  .grain{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/></svg>");}

  .app{position:relative;z-index:1;max-width:480px;margin:0 auto;padding:0 20px 130px;min-height:100dvh;}
  @media(min-width:768px){.app{max-width:540px;}}

  header.brand{display:flex;align-items:center;gap:13px;padding:26px 2px 16px;}
  .logo{width:46px;height:46px;flex:0 0 46px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.45));}
  .brand h1{margin:0;font-family:var(--serif);font-weight:900;font-size:23px;letter-spacing:.42em;text-indent:.1em;background:linear-gradient(180deg,#ffffff,#c9e2f2);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .brand .tag{font-size:10.5px;color:var(--gold);letter-spacing:.3em;margin-top:4px;opacity:.9;}
  .brand-rule{height:1px;background:linear-gradient(90deg,transparent,rgba(231,197,132,.4) 30%,rgba(231,197,132,.4) 70%,transparent);margin:0 2px 4px;}

  .card{
    position:relative;
    background:linear-gradient(160deg,rgba(255,255,255,.075),rgba(255,255,255,.02) 55%),rgba(9,26,46,.55);
    border:1px solid var(--line);border-radius:22px;padding:20px;margin:14px 0;
    backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);
    box-shadow:0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08);
    animation:rise .55s cubic-bezier(.22,.8,.3,1) both;
  }
  @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

  .auth-wrap{padding-top:7vh;}
  .auth-hero{text-align:center;margin-bottom:20px;animation:rise .6s cubic-bezier(.22,.8,.3,1) both;}
  .auth-hero .big{font-family:var(--serif);font-weight:900;font-size:46px;letter-spacing:.38em;text-indent:.38em;background:linear-gradient(180deg,#ffffff 20%,#bfdff5);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 20px 50px rgba(63,167,221,.25);}
  .ornament{display:flex;align-items:center;justify-content:center;gap:12px;margin:12px auto 10px;max-width:230px;}
  .ornament::before,.ornament::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(231,197,132,.55));}
  .ornament::after{background:linear-gradient(90deg,rgba(231,197,132,.55),transparent);}
  .ornament .gem{width:6px;height:6px;background:var(--gold);transform:rotate(45deg);box-shadow:0 0 12px rgba(231,197,132,.8);}
  .auth-hero p{color:var(--muted);font-size:13.5px;margin:4px 0 0;letter-spacing:.04em;}

  label{display:block;font-size:11px;color:var(--gold);letter-spacing:.22em;margin:16px 2px 8px;opacity:.85;}
  input{width:100%;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:rgba(2,12,24,.5);color:#fff;font-size:16px;outline:none;font-family:var(--sans);transition:border-color .2s,box-shadow .2s;}
  input::placeholder{color:var(--faint);}
  input:focus{border-color:rgba(231,197,132,.65);box-shadow:0 0 0 3px rgba(231,197,132,.15);}

  .btn{
    width:100%;padding:15px;border:none;border-radius:15px;font-size:16px;font-weight:800;letter-spacing:.12em;cursor:pointer;margin-top:20px;font-family:var(--sans);
    background:linear-gradient(180deg,#f4dfae,#dfba74 55%,#c89b52);color:#2a1d07;
    box-shadow:0 14px 34px rgba(200,155,82,.32), inset 0 1px 0 rgba(255,255,255,.55);
    transition:transform .2s,box-shadow .2s,filter .2s;
  }
  .btn:hover{transform:translateY(-1px);filter:brightness(1.05);box-shadow:0 18px 40px rgba(200,155,82,.4), inset 0 1px 0 rgba(255,255,255,.55);}
  .btn:active{transform:translateY(1px);}
  .btn.ghost{background:transparent;border:1px solid var(--line);box-shadow:none;color:var(--ink);font-weight:600;letter-spacing:.08em;}
  .btn.ghost:hover{border-color:rgba(231,197,132,.5);filter:none;}

  .switch{text-align:center;margin-top:16px;font-size:13px;color:var(--muted);}
  .switch a{color:var(--gold);font-weight:700;text-decoration:none;cursor:pointer;border-bottom:1px solid rgba(231,197,132,.35);padding-bottom:1px;}
  .err{color:#ff9a9a;font-size:12.5px;text-align:center;margin-top:12px;min-height:16px;}

  .userbar{display:flex;align-items:center;justify-content:space-between;margin:12px 0 6px;}
  .userbar .hi{font-size:14px;color:var(--muted);} .userbar .hi b{color:#fff;font-weight:700;}
  .pts{display:flex;align-items:center;gap:8px;background:linear-gradient(160deg,rgba(231,197,132,.16),rgba(231,197,132,.05));border:1px solid rgba(231,197,132,.4);padding:7px 14px;border-radius:999px;color:var(--gold-2);box-shadow:0 6px 18px rgba(0,0,0,.25);}
  .pts .coin{width:17px;height:17px;flex:0 0 17px;}
  .pts span{font-family:var(--num);font-size:18px;font-weight:700;line-height:1;}
  .pts small{color:var(--muted);font-weight:500;font-size:11px;}

  .ann{font-size:12.5px;color:var(--gold-2);background:linear-gradient(160deg,rgba(231,197,132,.1),rgba(231,197,132,.03));border:1px solid rgba(231,197,132,.25);border-radius:14px;padding:10px 14px;margin:10px 0;letter-spacing:.02em;}
  .ann:empty{display:none;}

  .sect-t{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--gold);letter-spacing:.24em;margin:22px 2px 4px;font-weight:700;}
  .sect-t::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(231,197,132,.35),transparent);}

  .match .lg{font-size:11px;color:var(--faint);display:flex;justify-content:space-between;letter-spacing:.08em;margin-bottom:14px;}
  .match .lg span:last-child{color:var(--muted);}
  .teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:16px;}
  .team{display:flex;flex-direction:column;align-items:center;gap:7px;}
  .team .fl{font-size:30px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4));}
  .team .nm{font-size:13.5px;font-weight:700;text-align:center;line-height:1.25;}
  .vs{font-family:var(--num);font-style:italic;font-size:15px;color:var(--gold);letter-spacing:.1em;opacity:.85;}
  .picks{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;}
  .pick{border:1px solid var(--line);background:rgba(4,16,30,.45);border-radius:16px;padding:11px 6px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s,transform .18s,box-shadow .2s;}
  .pick:hover:not(.locked){border-color:rgba(231,197,132,.5);transform:translateY(-2px);}
  .pick .p-l{font-size:11px;color:var(--muted);}
  .pick .p-o{font-family:var(--num);font-size:22px;font-weight:600;color:#fff;margin-top:2px;line-height:1.1;}
  .pick .p-pts{font-size:10.5px;color:var(--gold);letter-spacing:.06em;margin-top:3px;}
  .pick.sel{border-color:rgba(231,197,132,.8);background:linear-gradient(170deg,rgba(231,197,132,.18),rgba(231,197,132,.05));box-shadow:0 0 0 1px rgba(231,197,132,.35) inset,0 8px 22px rgba(200,155,82,.18);}
  .pick.locked{opacity:.55;cursor:default;}
  .pick.win{border-color:rgba(62,207,154,.7);background:linear-gradient(170deg,rgba(62,207,154,.16),rgba(62,207,154,.04));}
  .mstat{font-size:11.5px;margin-top:12px;color:var(--faint);text-align:center;letter-spacing:.03em;}
  .mstat.done{color:var(--good);} .mstat.lost{color:var(--bad);} .mstat.mine b{color:var(--gold-2);}

  .lb-row{display:flex;align-items:center;gap:14px;padding:12px 4px;border-bottom:1px solid var(--line-soft);}
  .lb-row:last-child{border-bottom:none;}
  .rk{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--num);font-weight:700;font-size:15px;color:var(--faint);}
  .rk.g{background:linear-gradient(160deg,#f7e2ae,#c69a4d);color:#2a1d07;box-shadow:0 4px 14px rgba(198,154,77,.45);}
  .rk.s{background:linear-gradient(160deg,#eef3f8,#9fb0bf);color:#1c2732;box-shadow:0 4px 14px rgba(159,176,191,.3);}
  .rk.b{background:linear-gradient(160deg,#e2b087,#9c6a3f);color:#2b1607;box-shadow:0 4px 14px rgba(156,106,63,.35);}
  .lb-name{flex:1;font-weight:600;font-size:14.5px;}
  .lb-name.me{color:var(--gold-2);}
  .lb-name .meb{font-size:10px;background:linear-gradient(180deg,#dfba74,#c89b52);color:#2a1d07;padding:2px 7px;border-radius:7px;margin-left:7px;font-weight:800;vertical-align:1px;}
  .lb-pts{font-family:var(--num);font-weight:700;font-size:18px;color:var(--gold);}

  .foam-line{height:1px;background:linear-gradient(90deg,transparent,var(--line),transparent);margin:8px 0;}

  nav.tabs{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;z-index:5;pointer-events:none;}
  nav.tabs .in{pointer-events:auto;display:flex;gap:4px;background:rgba(7,20,37,.78);border:1px solid var(--line);backdrop-filter:blur(24px) saturate(140%);-webkit-backdrop-filter:blur(24px) saturate(140%);border-radius:24px;padding:8px;box-shadow:0 20px 50px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07);width:min(430px,calc(100% - 40px));}
  .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 0 8px;border-radius:17px;color:var(--muted);font-size:11px;letter-spacing:.1em;cursor:pointer;transition:color .2s,background .2s;}
  .tab svg{width:21px;height:21px;}
  .tab.on{color:var(--gold);background:rgba(231,197,132,.1);}

  .hidden{display:none !important;}
  .note{font-size:11.5px;color:var(--faint);text-align:center;margin:18px 6px 0;line-height:1.7;letter-spacing:.02em;}

  @media (prefers-reduced-motion: reduce){
    *,*::before,*::after{animation:none !important;transition:none !important;}
  }
</style>
</head>
<body>
<div class="bg"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="grain"></div>

<div class="app">
  <header class="brand">
    <svg class="logo" viewBox="0 0 48 48">
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3b4"/><stop offset="1" stop-color="#c89b52"/></linearGradient>
        <radialGradient id="sea" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#12385e"/><stop offset="1" stop-color="#04101f"/></radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#sea)" stroke="url(#ring)" stroke-width="1.4"/>
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="url(#ring)" stroke-width=".6" opacity=".55"/>
      <path d="M9 27 C15 20 19 31 24 25 C29 19 33 30 39 23" fill="none" stroke="#e7c584" stroke-width="2" stroke-linecap="round"/>
      <path d="M11 33 C16 27 20 36 24 31 C28 26 32 35 37 29" fill="none" stroke="#7fd0ef" stroke-width="1.7" stroke-linecap="round" opacity=".75"/>
    </svg>
    <div><h1>海洋</h1><div class="tag">估波 · 儲分 · 打排行榜</div></div>
  </header>
  <div class="brand-rule"></div>

  <section id="auth" class="auth-wrap">
    <div class="auth-hero">
      <div class="big">海洋</div>
      <div class="ornament"><div class="gem"></div></div>
      <p id="authSub">登入你嘅帳戶，開始估波儲分</p>
    </div>
    <div class="card">
      <label>帳號</label><input id="u" autocomplete="username" placeholder="改個名俾自己">
      <label>密碼</label><input id="p" type="password" autocomplete="current-password" placeholder="••••••••">
      <button class="btn" id="authBtn" onclick="doAuth()">登入</button>
      <div class="err" id="authErr"></div>
      <div class="switch" id="authSwitch">未有帳戶？<a onclick="toggleMode()">註冊一個</a></div>
    </div>
    <div class="note">積分純遊戲用嚟打排行榜，唔可以買、唔可以換錢。<br>估中先加分，估錯唔會扣，安心玩。</div>
  </section>

  <main id="main" class="hidden">
    <div class="userbar">
      <div class="hi">你好，<b id="uname">—</b> 👋</div>
      <div class="pts">
        <svg class="coin" viewBox="0 0 20 20"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3b4"/><stop offset="1" stop-color="#c89b52"/></linearGradient></defs><circle cx="10" cy="10" r="9" fill="url(#cg)"/><circle cx="10" cy="10" r="6.4" fill="none" stroke="#8f6a2e" stroke-width=".9" opacity=".55"/><path d="M6.5 11.5 C8 9.5 9 12.5 10.5 10.5 C12 8.5 13 11.5 14 10" fill="none" stroke="#5c421a" stroke-width="1.1" stroke-linecap="round"/></svg>
        <span id="upts">0</span> <small>分</small>
      </div>
    </div>
    <section id="view-matches">
      <div class="ann" id="ann"></div>
      <div class="sect-t">今期賽事 · 估中邊隊贏</div>
      <div id="matchList"></div>
      <div class="note">估咗就 lock，等賽果出咗，估中即刻上分（估啱冷門加多啲）。估錯唔會扣分。</div>
    </section>
    <section id="view-lb" class="hidden">
      <div class="sect-t">排行榜 · 邊個估得最叻</div><div class="card" id="lbBox"></div>
      <div class="note">排名淨係計積分，積分係遊戲分數，唔涉及任何金錢。</div>
    </section>
    <section id="view-me" class="hidden">
      <div class="sect-t">我嘅帳戶</div>
      <div class="card">
        <div class="userbar" style="margin:0"><div class="hi">帳號</div><b id="meName">—</b></div><div class="foam-line"></div>
        <div class="userbar" style="margin:0"><div class="hi">總積分</div><span class="lb-pts" id="mePts">0</span></div><div class="foam-line"></div>
        <div class="userbar" style="margin:0"><div class="hi">估中率</div><b id="meRate">—</b></div>
      </div>
      <button class="btn ghost" onclick="logout()">登出</button>
      <div class="note">積分係遊戲分數，唔可以買、唔可以換錢。</div>
    </section>
  </main>
</div>

<nav class="tabs hidden" id="nav"><div class="in">
  <div class="tab on" data-v="matches" onclick="go('matches')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5 15.8 10.3 14.4 14.7 9.6 14.7 8.2 10.3Z"/><path d="M12 3v4.5M20.6 9.1l-4.8 1.2M17.3 20l-2.9-5.3M6.7 20l2.9-5.3M3.4 9.1l4.8 1.2"/></svg>
    賽事
  </div>
  <div class="tab" data-v="lb" onclick="go('lb')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a1 1 0 0 0-1 1.2C4 9.5 5.5 10.6 7 10.8M17 6h2.5a1 1 0 0 1 1 1.2C20 9.5 18.5 10.6 17 10.8"/></svg>
    排行榜
  </div>
  <div class="tab" data-v="me" onclick="go('me')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>
    我
  </div>
</div></nav>

<script>
/* ASP 版：用 session cookie 登入，API 係 api_*.asp，POST 用表單格式 */
let ME = null, MATCHES = [], MYPICKS = {}, mode = 'login', poll = null;

async function api(pathn, data) {
  const opts = data ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() } : {};
  const r = await fetch(pathn, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('錯誤 ' + r.status));
  return j;
}
function toggleMode() { mode = mode === 'login' ? 'register' : 'login'; renderAuthMode(); }
function renderAuthMode() {
  authBtn.textContent = mode === 'login' ? '登入' : '註冊';
  authSub.textContent = mode === 'login' ? '登入你嘅帳戶，開始估波儲分' : '改個名同密碼，即刻開始玩';
  authSwitch.innerHTML = mode === 'login' ? '未有帳戶？<a onclick="toggleMode()">註冊一個</a>' : '已經有帳戶？<a onclick="toggleMode()">去登入</a>';
  authErr.textContent = '';
}
async function doAuth() {
  const username = u.value.trim(), password = p.value;
  if (!username || !password) { authErr.textContent = '請填帳號同密碼'; return; }
  try {
    const j = await api(mode === 'register' ? 'api_register.asp' : 'api_login.asp', { username, password });
    ME = j.user; enter();
  } catch (e) { authErr.textContent = e.message; }
}
async function logout() {
  if (poll) clearInterval(poll);
  try { await api('api_logout.asp', { bye: 1 }); } catch (e) {}
  location.reload();
}

function enter() {
  auth.classList.add('hidden'); main.classList.remove('hidden'); nav.classList.remove('hidden');
  uname.textContent = ME.username; refresh(); go('matches');
  if (poll) clearInterval(poll); poll = setInterval(refresh, 5000);
}
async function refresh() {
  try {
    const me = await api('api_me.asp'); ME = me.user; renderTop();
    const md = await api('api_matches.asp'); MATCHES = md.matches; ann.textContent = md.announcement || '';
    const mp = await api('api_mypicks.asp'); MYPICKS = {}; mp.picks.forEach(p => MYPICKS[p.matchId] = p);
    renderMatches(); if (!document.getElementById('view-lb').classList.contains('hidden')) renderLB();
    renderProfile();
  } catch (e) { if (String(e.message).includes('登入')) { if (poll) clearInterval(poll); location.reload(); } }
}
function renderTop() { upts.textContent = ME.points; }
function ptsFor(o) { return Math.round((+o || 1) * 10); }
function selName(m, k) { return k === 'home' ? m.home.n : k === 'draw' ? '和' : m.away.n; }

function renderMatches() {
  const list = matchList; list.innerHTML = '';
  if (!MATCHES.length) { list.innerHTML = '<div class="card" style="text-align:center;color:var(--muted)">暫時未有賽事，等陣再嚟 🌊</div>'; return; }
  MATCHES.forEach((m, i) => {
    const pick = MYPICKS[m.id]; const settled = pick && pick.status !== 'open';
    const wrap = document.createElement('div'); wrap.className = 'card match';
    wrap.style.animationDelay = (i * 0.06) + 's';
    let ph = '';
    ['home', 'draw', 'away'].forEach(k => {
      const sel = pick && pick.sel === k ? 'sel' : '', locked = pick ? 'locked' : '', win = settled && m.result === k ? 'win' : '';
      ph += `<div class="pick ${sel} ${locked} ${win}" onclick="predict(${m.id},'${k}')"><div class="p-l">${selName(m, k)}</div><div class="p-o">${(+m.o[k]).toFixed(2)}</div><div class="p-pts">+${ptsFor(m.o[k])}</div></div>`;
    });
    let stat = '';
    if (!pick) stat = `<div class="mstat">揀一個估法 · 估中先加分，估錯唔扣</div>`;
    else if (!settled) stat = `<div class="mstat mine">你估：<b>${selName(m, pick.sel)}</b> · 等賽果</div>`;
    else if (pick.status === 'won') stat = `<div class="mstat done">賽果：<b>${selName(m, m.result)}</b> · 估中 +${pick.earned} 分 🎉</div>`;
    else stat = `<div class="mstat lost">賽果：<b>${selName(m, m.result)}</b> · 今次估唔中，下次加油</div>`;
    wrap.innerHTML = `<div class="lg"><span>${m.league}</span><span>${m.time}</span></div>
      <div class="teams"><div class="team"><div class="fl">${m.home.f}</div><div class="nm">${m.home.n}</div></div><div class="vs">VS</div><div class="team"><div class="fl">${m.away.f}</div><div class="nm">${m.away.n}</div></div></div>
      <div class="picks">${ph}</div>${stat}`;
    list.appendChild(wrap);
  });
}
async function predict(matchId, sel) {
  if (MYPICKS[matchId]) return;
  try { await api('api_predict.asp', { matchId, sel }); await refresh(); }
  catch (e) { alert(e.message); }
}
async function renderLB() {
  try {
    const j = await api('api_leaderboard.asp'); const box = lbBox; box.innerHTML = '';
    if (!j.leaderboard.length) { box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:8px">未有排名，快啲估波上分！</div>'; return; }
    j.leaderboard.forEach((r, i) => {
      const cls = i === 0 ? 'g' : i === 1 ? 's' : i === 2 ? 'b' : '';
      const isMe = ME && r.username === ME.username;
      box.innerHTML += `<div class="lb-row"><div class="rk ${cls}">${i + 1}</div><div class="lb-name ${isMe ? 'me' : ''}">${r.username}${isMe ? '<span class="meb">你</span>' : ''}</div><div class="lb-pts">${r.points}</div></div>`;
    });
  } catch (e) {}
}
function renderProfile() {
  if (!ME) return; meName.textContent = ME.username; mePts.textContent = ME.points;
  meRate.textContent = ME.played ? Math.round(ME.correct / ME.played * 100) + '%（' + ME.correct + '/' + ME.played + '）' : '未有紀錄';
}
function go(v) {
  document.querySelectorAll('nav .tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
  document.getElementById('view-matches').classList.toggle('hidden', v !== 'matches');
  document.getElementById('view-lb').classList.toggle('hidden', v !== 'lb');
  document.getElementById('view-me').classList.toggle('hidden', v !== 'me');
  if (v === 'lb') renderLB(); if (v === 'me') renderProfile(); window.scrollTo(0, 0);
}
/* boot：有 session 就直接入 */
renderAuthMode();
(async () => { try { const me = await api('api_me.asp'); ME = me.user; enter(); } catch (e) {} })();
</script>
</body>
</html>
