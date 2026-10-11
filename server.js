/* ============================================================
   海洋 Ocean — 後台伺服器 (Node + Express + JSON 檔案儲存)
   純積分估波遊戲：估中先加分，估錯唔扣分（gain-only）。
   積分只係遊戲分數，唔可以買、唔可以換錢、唔涉及任何金錢。
   原創程式碼。行法：  npm install   然後   node server.js
   開：   玩家  http://localhost:3000
         後台  http://localhost:3000/admin
   預設管理員：admin / admin123（第一次行自動建立，記得改密碼）
   ============================================================ */
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');

const DB_FILE = path.join(__dirname, 'data.json');
const PORT    = process.env.PORT || 3000;

/* ---------- JSON 儲存 ---------- */
let db, saveTimer = null;
function loadDB() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { db = null; }
  if (!db) db = seed();
  db.users   = db.users   || [];
  db.matches = db.matches || [];
  db.picks   = db.picks   || [];
  db.seq     = db.seq     || { user: 1, match: 1, pick: 1 };
  if (db.announcement == null) db.announcement = '歡迎嚟到 海洋 🌊 估中邊隊贏就加分，估錯唔扣，安心玩！';
}
function saveDB() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)), 120); }
function nextId(k) { return db.seq[k]++; }

/* ---------- 密碼雜湊 (scrypt) ---------- */
function hashPw(pw, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') }; }
function checkPw(pw, salt, hash) { return crypto.scryptSync(pw, salt, 32).toString('hex') === hash; }

/* ---------- token (記憶體) ---------- */
const tokens = new Map();
function makeToken(uid) { const t = crypto.randomBytes(24).toString('hex'); tokens.set(t, uid); return t; }
function userFromReq(req) { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const uid = tokens.get(t); return uid ? db.users.find(u => u.id === uid) : null; }
function auth(req, res, next) { const u = userFromReq(req); if (!u) return res.status(401).json({ error: '請先登入' }); req.user = u; next(); }
function adminOnly(req, res, next) { if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: '需要管理員權限' }); next(); }
function pubUser(u) { return { id: u.id, username: u.username, points: u.points, correct: u.correct || 0, played: u.played || 0, isAdmin: !!u.isAdmin }; }

/* ---------- 種子 ---------- */
function seed() {
  const a = hashPw('admin123');
  return {
    seq: { user: 2, match: 1, pick: 1 },
    users: [{ id: 1, username: 'admin', salt: a.salt, hash: a.hash, points: 0, correct: 0, played: 0, isAdmin: true, createdAt: Date.now() }],
    announcement: '歡迎嚟到 海洋 🌊 估中邊隊贏就加分，估錯唔扣，安心玩！',
    matches: [], picks: []
  };
}

/* ---------- 積分：估中先加分（賠率高＝難度高＝加多啲），估錯 0 ---------- */
function ptsFor(odd) { return Math.round((+odd || 1) * 10); }

/* ---------- 真實賽程：免費 TheSportsDB（唔使登記；betsapi 之後可換入嚟） ---------- */
const FEEDS = [
  { id: '4346', name: '美職聯' }, { id: '4351', name: '巴甲' }, { id: '4328', name: '英超' },
  { id: '4335', name: '西甲' }, { id: '4332', name: '意甲' }, { id: '4331', name: '德甲' }
];
function httpsGetJson(url) { return new Promise((ok, no) => { https.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch (e) { no(e); } }); }).on('error', no); }); }
/* 由主隊強度產生 1X2 賠率（原創，加水位 margin） */
function genOdds(pHome) {
  pHome = Math.max(0.18, Math.min(0.72, pHome));
  let pDraw = 0.24 + (0.5 - Math.abs(0.5 - pHome)) * 0.18;
  let pAway = 1 - pHome - pDraw; if (pAway < 0.08) { pAway = 0.08; pDraw = 1 - pHome - pAway; }
  const M = 1.06, od = p => Math.max(1.10, +((1 / p) / M).toFixed(2));
  return { home: od(pHome), draw: od(pDraw), away: od(pAway) };
}
function fmtTime(ts) { try { return new Date(ts).toLocaleString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return ts || '待定'; } }
async function importFixtures(leagueId) {
  const feed = FEEDS.find(f => f.id === String(leagueId)) || { id: String(leagueId), name: '聯賽' };
  const j = await httpsGetJson(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${feed.id}`);
  const events = (j && j.events) || []; let added = 0;
  events.slice(0, 8).forEach(ev => {
    if (!ev.strHomeTeam || !ev.strAwayTeam || db.matches.find(m => m.src === ev.idEvent)) return;
    db.matches.push({ id: nextId('match'), src: ev.idEvent, league: ev.strLeague || feed.name,
      time: fmtTime(ev.strTimestamp || ev.dateEvent), home: { n: ev.strHomeTeam, f: '⚽' }, away: { n: ev.strAwayTeam, f: '⚽' },
      o: genOdds(0.30 + Math.random() * 0.4), status: 'upcoming', result: null, hs: '-', as: '-' });
    added++;
  });
  saveDB(); return added;
}
function fallbackMatches() {
  const demo = [
    ['英超', '利物浦', '🔴', '阿仙奴', '🔵', 0.55], ['西甲', '巴塞', '🔵', '皇馬', '⚪', 0.45],
    ['意甲', '國際米蘭', '🔵', '祖雲達斯', '⚫', 0.50], ['德甲', '拜仁', '🔴', '多蒙特', '🟡', 0.62]
  ];
  demo.forEach(d => db.matches.push({ id: nextId('match'), src: 'demo' + d[1], league: d[0], time: '稍後開賽',
    home: { n: d[1], f: d[2] }, away: { n: d[3], f: d[4] }, o: genOdds(d[5]), status: 'upcoming', result: null, hs: '-', as: '-' }));
  saveDB();
}

/* ---------- 結算：開賽果 → 幫估中嘅人加分（gain-only） ---------- */
function settleMatch(m) {
  if (!m.result) return 0;
  let n = 0;
  for (const p of db.picks) {
    if (p.matchId !== m.id || p.status !== 'open') continue;
    const u = db.users.find(x => x.id === p.userId); if (u) u.played = (u.played || 0) + 1;
    if (p.sel === m.result) { const add = ptsFor(p.odd); p.status = 'won'; p.earned = add; if (u) { u.points += add; u.correct = (u.correct || 0) + 1; } }
    else { p.status = 'lost'; p.earned = 0; }
    n++;
  }
  return n;
}

/* ---------- boot ---------- */
loadDB();
(async () => {
  if (db.matches.length === 0) {
    try { await importFixtures('4346'); await importFixtures('4351'); if (db.matches.length < 4) fallbackMatches();
      console.log('已載入賽程，共 ' + db.matches.length + ' 場'); }
    catch (e) { console.log('真實賽程載入失敗，改用樣板：' + e.message); fallbackMatches(); }
  }
})();

/* ============================================================ HTTP ============================================================ */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---- 帳戶（玩家自己註冊） ---- */
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '請填帳號同密碼' });
  if (db.users.find(u => u.username.toLowerCase() === String(username).toLowerCase())) return res.status(400).json({ error: '呢個帳號已經有人用' });
  const h = hashPw(password);
  const u = { id: nextId('user'), username: String(username), salt: h.salt, hash: h.hash, points: 0, correct: 0, played: 0, isAdmin: false, createdAt: Date.now() };
  db.users.push(u); saveDB();
  res.json({ token: makeToken(u.id), user: pubUser(u) });
});
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.users.find(x => x.username.toLowerCase() === String(username || '').toLowerCase());
  if (!u || !checkPw(password || '', u.salt, u.hash)) return res.status(400).json({ error: '帳號或密碼唔啱' });
  res.json({ token: makeToken(u.id), user: pubUser(u) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: pubUser(req.user) }));

/* ---- 遊戲 ---- */
app.get('/api/matches', (req, res) => res.json({ matches: db.matches, announcement: db.announcement }));
app.get('/api/leaderboard', (req, res) => {
  const arr = db.users.filter(u => !u.isAdmin).map(u => ({ username: u.username, points: u.points, correct: u.correct || 0, played: u.played || 0 }))
    .sort((a, b) => b.points - a.points).slice(0, 50);
  res.json({ leaderboard: arr });
});
app.post('/api/predict', auth, (req, res) => {
  const { matchId, sel } = req.body || {};
  const m = db.matches.find(x => x.id === matchId);
  if (!m) return res.status(404).json({ error: '搵唔到呢場賽事' });
  if (m.status === 'finished') return res.status(400).json({ error: '呢場已經完咗' });
  if (!['home', 'draw', 'away'].includes(sel)) return res.status(400).json({ error: '估法唔啱' });
  if (db.picks.find(p => p.userId === req.user.id && p.matchId === matchId)) return res.status(400).json({ error: '你已經估咗呢場' });
  const odd = m.o[sel];
  const pick = { id: nextId('pick'), userId: req.user.id, matchId, sel, odd, status: 'open', earned: 0, createdAt: Date.now() };
  db.picks.push(pick); saveDB();
  res.json({ pick, willEarn: ptsFor(odd) });
});
app.get('/api/mypicks', auth, (req, res) => res.json({ picks: db.picks.filter(p => p.userId === req.user.id).sort((a, b) => b.createdAt - a.createdAt) }));

/* ---- 後台 admin（純遊戲管理：賽事／賽果／玩家；冇錢、冇會員落注戶口） ---- */
app.post('/api/admin/match', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  if (b.id) { const ex = db.matches.find(x => x.id === b.id); if (!ex) return res.status(404).json({ error: '搵唔到' }); Object.assign(ex, b); }
  else {
    const m = { id: nextId('match'), league: b.league || '賽事', time: b.time || '稍後開賽',
      home: { n: (b.home && b.home.n) || '主隊', f: (b.home && b.home.f) || '⚽' },
      away: { n: (b.away && b.away.n) || '客隊', f: (b.away && b.away.f) || '⚽' },
      o: b.o || { home: 2.0, draw: 3.2, away: 3.4 }, status: 'upcoming', result: null, hs: '-', as: '-' };
    db.matches.push(m);
  }
  saveDB(); res.json({ ok: true });
});
app.delete('/api/admin/match/:id', auth, adminOnly, (req, res) => { db.matches = db.matches.filter(x => x.id !== +req.params.id); saveDB(); res.json({ ok: true }); });
app.post('/api/admin/result', auth, adminOnly, (req, res) => {
  const { matchId, hs, as, result, status } = req.body || {};
  const m = db.matches.find(x => x.id === matchId); if (!m) return res.status(404).json({ error: '搵唔到' });
  if (hs != null) m.hs = hs; if (as != null) m.as = as;
  if (status) m.status = status;
  let settled = 0;
  if (result) { m.result = result; m.status = 'finished'; settled = settleMatch(m); }
  saveDB(); res.json({ ok: true, settled });
});
app.post('/api/admin/announcement', auth, adminOnly, (req, res) => { db.announcement = String((req.body || {}).text || ''); saveDB(); res.json({ ok: true }); });
app.get('/api/admin/users', auth, adminOnly, (req, res) => res.json({ users: db.users.map(pubUser) }));
app.post('/api/admin/import', auth, adminOnly, async (req, res) => {
  try { const added = await importFixtures((req.body || {}).leagueId || '4328'); res.json({ ok: true, added }); }
  catch (e) { res.status(500).json({ error: '匯入失敗：' + e.message }); }
});
app.get('/api/admin/feeds', auth, adminOnly, (req, res) => res.json({ feeds: FEEDS }));
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  const players = db.users.filter(u => !u.isAdmin);
  res.json({ stats: {
    players: players.length,
    totalPoints: players.reduce((s, u) => s + u.points, 0),
    matches: db.matches.length,
    finished: db.matches.filter(m => m.status === 'finished').length,
    upcoming: db.matches.filter(m => m.status === 'upcoming').length,
    picks: db.picks.length,
    correctPicks: db.picks.filter(p => p.status === 'won').length
  } });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.listen(PORT, () => console.log(`🌊 海洋 Ocean 行緊： http://localhost:${PORT}  （後台 /admin）`));
