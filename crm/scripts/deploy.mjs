#!/usr/bin/env node
// 一鍵部署：開 Supabase 項目（新加坡）→ 建資料庫 → 驗證權限 → 部署去 Vercel → 開管理員帳戶
//
// 用法（喺 crm/ 目錄）：
//   SUPABASE_ACCESS_TOKEN=… VERCEL_TOKEN=… node scripts/deploy.mjs --admin-email ryan@example.com [--admin-name Ryan]
//
// 可選環境變數：SUPABASE_ORG_ID、VERCEL_TEAM_ID、PROJECT_NAME（預設 team-crm）、DATA_ENCRYPTION_KEY（重新部署時沿用舊鑰匙）
// 重複執行係安全嘅：已存在嘅項目、已行過嘅 migration 會跳過。

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const SB_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const VC_TOKEN = process.env.VERCEL_TOKEN;
const NAME = process.env.PROJECT_NAME || "team-crm";
const ADMIN_EMAIL = args["admin-email"];
const ADMIN_NAME = args["admin-name"] || "Ryan";
const OUT = args.out || path.join(ROOT, ".deploy-output.json");

if (!SB_TOKEN || !VC_TOKEN || !ADMIN_EMAIL) {
  console.error("需要 SUPABASE_ACCESS_TOKEN、VERCEL_TOKEN 同 --admin-email");
  process.exit(1);
}

const log = (...m) => console.log("▶", ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pw = (n = 16) => randomBytes(n).toString("base64url").slice(0, n) + "9a";

async function api(base, token, method, p, body) {
  const res = await fetch(base + p, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}
const sb = (m, p, b) => api("https://api.supabase.com", SB_TOKEN, m, p, b);
const vcQ = process.env.VERCEL_TEAM_ID ? `teamId=${process.env.VERCEL_TEAM_ID}` : "";
const vc = (m, p, b) => api("https://api.vercel.com", VC_TOKEN, m, p + (vcQ ? (p.includes("?") ? "&" : "?") + vcQ : ""), b);
const must = (r, what) => {
  if (!r.ok) throw new Error(`${what} 失敗（${r.status}）：${JSON.stringify(r.json)}`);
  return r.json;
};

// ---------------- Supabase ----------------
async function supabaseProject() {
  const projects = must(await sb("GET", "/v1/projects"), "讀取 Supabase 項目");
  let p = projects.find((x) => x.name === NAME);
  let dbPass;
  if (!p) {
    let org = process.env.SUPABASE_ORG_ID;
    if (!org) org = must(await sb("GET", "/v1/organizations"), "讀取 Supabase 組織")[0]?.id;
    if (!org) throw new Error("Supabase 帳戶未有組織（organization）");
    dbPass = pw(24);
    log(`開新 Supabase 項目「${NAME}」（新加坡）…`);
    p = must(
      await sb("POST", "/v1/projects", { name: NAME, organization_id: org, db_pass: dbPass, region: "ap-southeast-1" }),
      "開 Supabase 項目",
    );
  } else log(`沿用現有 Supabase 項目「${NAME}」（${p.id}）`);
  const ref = p.id ?? p.ref;
  for (let i = 0; i < 60; i++) {
    const s = must(await sb("GET", `/v1/projects/${ref}`), "讀取項目狀態");
    if (s.status === "ACTIVE_HEALTHY") break;
    if (i === 0) log("等緊 Supabase 啟動（大約 1–3 分鐘）…");
    await sleep(10_000);
  }
  return { ref, dbPass };
}

async function sql(ref, query) {
  return sb("POST", `/v1/projects/${ref}/database/query`, { query });
}

async function migrate(ref) {
  must(await sql(ref, "create table if not exists public._migrations (name text primary key, at timestamptz default now())"), "建立 migration 記錄表");
  must(await sql(ref, "alter table public._migrations enable row level security; revoke all on public._migrations from anon, authenticated;"), "保護 migration 記錄表");
  const done = new Set((must(await sql(ref, "select name from public._migrations"), "讀取 migration") ?? []).map((r) => r.name));
  const dir = path.join(ROOT, "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    log(`行 migration ${f}`);
    const body = readFileSync(path.join(dir, f), "utf8");
    must(await sql(ref, `begin;\n${body}\ninsert into public._migrations (name) values ('${f}');\ncommit;`), f);
  }
}

async function rlsCheck(ref) {
  const body = readFileSync(path.join(ROOT, "supabase/tests/rls_check.sql"), "utf8");
  const r = await sql(ref, body);
  const msg = JSON.stringify(r.json);
  if (msg.includes("全部 RLS 測試通過") || msg.includes("\\u5168\\u90e8 RLS")) return log("✅ 權限（RLS）測試全部通過");
  throw new Error("權限測試唔通過，停止部署：" + msg);
}

async function keys(ref) {
  const list = must(await sb("GET", `/v1/projects/${ref}/api-keys?reveal=true`), "讀取 API keys");
  const find = (names) => list.find((k) => names.includes(k.name) || names.includes(k.type))?.api_key;
  const anon = find(["anon", "publishable"]);
  const service = find(["service_role", "secret"]);
  if (!anon || !service) throw new Error("搵唔到 Supabase API keys：" + JSON.stringify(list.map((k) => k.name)));
  return { url: `https://${ref}.supabase.co`, anon, service };
}

async function authConfig(ref, siteUrl) {
  must(
    await sb("PATCH", `/v1/projects/${ref}/config/auth`, {
      disable_signup: true,
      mailer_autoconfirm: true,
      ...(siteUrl ? { site_url: siteUrl, uri_allow_list: `${siteUrl}/**` } : {}),
    }),
    "設定登入（熄自行註冊）",
  );
}

async function createAdmin(ref, k) {
  const exists = must(await sql(ref, `select id from public.profiles where lower(email) = lower('${ADMIN_EMAIL.replace(/'/g, "''")}')`), "查管理員");
  let password = null;
  if (!exists?.length) {
    password = pw(14);
    const res = await fetch(`${k.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: k.service, Authorization: `Bearer ${k.service}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password, email_confirm: true, app_metadata: { full_name: ADMIN_NAME } }),
    });
    if (!res.ok) throw new Error("開管理員帳戶失敗：" + (await res.text()));
    log(`已開管理員帳戶 ${ADMIN_EMAIL}`);
  } else log(`管理員帳戶 ${ADMIN_EMAIL} 已存在`);
  must(
    await sql(
      ref,
      `update public.profiles set role = 'admin', full_name = coalesce(nullif(full_name, ''), '${ADMIN_NAME.replace(/'/g, "''")}') where lower(email) = lower('${ADMIN_EMAIL.replace(/'/g, "''")}')`,
    ),
    "設定管理員",
  );
  return password;
}

// ---------------- Vercel ----------------
async function vercelProject(env) {
  let p = (await vc("GET", `/v9/projects/${NAME}`)).json;
  if (!p?.id) {
    log(`開新 Vercel 項目「${NAME}」…`);
    // 試連 GitHub（之後 push 會自動更新）；Vercel 未裝 GitHub App 就唔連
    let r = await vc("POST", "/v11/projects", {
      name: NAME,
      framework: "nextjs",
      rootDirectory: "crm",
      gitRepository: { type: "github", repo: "momobotttt/ocean" },
    });
    if (!r.ok) {
      log("（未能連 GitHub，改為直接上載部署；之後要更新就再行呢個 script）");
      r = await vc("POST", "/v11/projects", { name: NAME, framework: "nextjs" });
    }
    p = must(r, "開 Vercel 項目");
  } else log(`沿用現有 Vercel 項目「${NAME}」`);
  const vars = Object.entries(env).map(([key, value]) => ({
    key,
    value,
    type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "sensitive",
    target: ["production", "preview"],
  }));
  must(await vc("POST", `/v10/projects/${p.id}/env?upsert=true`, vars), "設定 Vercel 環境變數");
  return p;
}

function deploy(p) {
  log("上載同 build（大約 2–3 分鐘）…");
  const out = execFileSync(
    "npx",
    ["--yes", "vercel@latest", "deploy", "--prod", "--yes", "--token", VC_TOKEN, ...(process.env.VERCEL_TEAM_ID ? ["--scope", process.env.VERCEL_TEAM_ID] : [])],
    { cwd: ROOT, env: { ...process.env, VERCEL_ORG_ID: p.accountId, VERCEL_PROJECT_ID: p.id }, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return out.trim().split("\n").pop();
}

async function productionUrl(p, fallback) {
  const d = (await vc("GET", `/v9/projects/${p.id}/domains`)).json?.domains ?? [];
  const best = d.find((x) => !x.redirect && x.name.endsWith(".vercel.app")) ?? d[0];
  return best ? `https://${best.name}` : fallback;
}

// ---------------- 主流程 ----------------
const { ref, dbPass } = await supabaseProject();
await migrate(ref);
await rlsCheck(ref);
const k = await keys(ref);
await authConfig(ref);

const encKey = process.env.DATA_ENCRYPTION_KEY || randomBytes(32).toString("base64");
const vp = await vercelProject({
  NEXT_PUBLIC_SUPABASE_URL: k.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: k.anon,
  SUPABASE_SERVICE_ROLE_KEY: k.service,
  DATA_ENCRYPTION_KEY: encKey,
});
const deployUrl = deploy(vp);
const site = await productionUrl(vp, deployUrl);
await authConfig(ref, site);
must(await vc("POST", `/v10/projects/${vp.id}/env?upsert=true`, [{ key: "APP_URL", value: site, type: "plain", target: ["production", "preview"] }]), "設定 APP_URL");
const adminPassword = await createAdmin(ref, k);

const result = {
  網址: site,
  管理員電郵: ADMIN_EMAIL,
  管理員臨時密碼: adminPassword ?? "（帳戶早已存在，密碼不變）",
  Supabase項目: `https://supabase.com/dashboard/project/${ref}`,
  資料庫密碼: dbPass ?? "（沿用現有項目）",
  加密鑰匙DATA_ENCRYPTION_KEY: encKey,
};
writeFileSync(OUT, JSON.stringify(result, null, 2));
log(`完成！網址：${site}`);
log(`敏感資料已寫入 ${OUT}（加密鑰匙、臨時密碼）— 請收好，唔好 commit。`);
