import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const mode = process.argv[2] || 'doctor';
const modes = ['setup', 'doctor', 'dev', 'build', 'start', 'check'];
if (!modes.includes(mode)) throw new Error(`Use: ${modes.join(', ')}`);
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('請先安裝 Node.js 24 LTS。'); process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(args) {
  const result = spawnSync(npm, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  if (result.error) { console.error('無法啟動 npm，請檢查 Node.js 安裝。'); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (mode === 'setup') {
  const local = resolve('.env.local');
  if (!existsSync(local)) copyFileSync('.env.example', local, constants.COPYFILE_EXCL);
  run(['ci']);
  console.log('依賴已安裝；請安全填寫 crm/.env.local。已有檔案不會覆蓋。');
  process.exit(0);
}
// Next.js uses its own environment precedence; use the same loader for diagnostics.
const envModule = await import('@next/env');
const { loadEnvConfig } = envModule.default ?? envModule;
loadEnvConfig(root, mode === 'dev');
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATA_ENCRYPTION_KEY'];
function valid(name) {
  const value = process.env[name]?.trim();
  if (!value || value === 'eyJ...' || value.includes('xxxxxxxx')) return false;
  if (name === 'NEXT_PUBLIC_SUPABASE_URL') {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }
  if (name === 'DATA_ENCRYPTION_KEY') return /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32;
  return true;
}
if (['doctor', 'dev', 'start'].includes(mode)) {
  for (const name of required) console.log(`${name}: ${valid(name) ? '已設定（未驗證服務連線）' : '缺少或格式無效'}`);
  if (required.some(name => !valid(name))) {
    console.error('請在 .env.local 補設定；現有資料必須使用原本加密鑰匙。'); process.exit(1);
  }
}
if (mode === 'doctor') console.log('本機設定檢查通過；未查詢或修改遠端資料。');
if (mode === 'check') { run(['run', 'lint']); run(['test']); }
if (mode === 'build') run(['run', 'build']);
if (mode === 'dev' || mode === 'start') run(['run', mode, '--', '--hostname', '127.0.0.1']);
