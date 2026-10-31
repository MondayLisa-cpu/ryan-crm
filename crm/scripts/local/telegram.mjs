// Local polling: exactly one worker per bot; no public inbound port required.
import {fileURLToPath} from 'node:url';
import env from '@next/env';
const root=fileURLToPath(new URL('../../',import.meta.url));env.loadEnvConfig(root,true);
const token=process.env.TELEGRAM_BOT_TOKEN,secret=process.env.TELEGRAM_WEBHOOK_SECRET;
if(!token||!secret||secret.length<32) throw new Error('請設定 TELEGRAM_BOT_TOKEN 及至少 32 字元的 TELEGRAM_WEBHOOK_SECRET。');
const origin=process.env.TELEGRAM_LOCAL_ORIGIN||'http://127.0.0.1:3000';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('只准轉交到本機 127.0.0.1');
async function telegram(method,body){
 const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const value=await r.json();if(!r.ok||!value.ok)throw new Error('Telegram API 未成功');return value.result;
}
const info=await telegram('getWebhookInfo',{});
if(info.url)throw new Error('此 bot 已有 webhook。請使用獨立測試 bot；本程式不會刪除現有 webhook。');
let offset;console.log('Telegram 本機接收已啟動。Ctrl+C 停止。');
while(true){
 try{
  await fetch(`${origin}/api/telegram`,{method:'PUT',headers:{'x-telegram-bot-api-secret-token':secret},signal:AbortSignal.timeout(180000)});
  const updates=await telegram('getUpdates',{offset,timeout:25,allowed_updates:['message']});
  for(const update of updates){
   const r=await fetch(`${origin}/api/telegram`,{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify(update),signal:AbortSignal.timeout(180000)});
   if(!r.ok)throw new Error('CRM 未完成處理');
   offset=update.update_id+1;
  }
 }catch{console.error('未完成接收，5 秒後重試；未輸出 token 或訊息內容。');await new Promise(r=>setTimeout(r,5000));}
}
