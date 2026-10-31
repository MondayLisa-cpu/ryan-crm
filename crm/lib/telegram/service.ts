import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '../supabase/admin';
import { encryptValue, decryptValue, parseKey } from '../crypto';
import { extractFromMessage } from '../whatsapp/ai';
import { hkToday } from '../weeks';
import { decision, updateSchema } from './protocol';
export const sealUpdate=(id:number,value:unknown)=>encryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),`telegram:${id}`,JSON.stringify(value));
export const openUpdate=(id:number,value:string)=>JSON.parse(decryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),`telegram:${id}`,value));
export async function sendTelegram(chat:string,text:string) {
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token) throw new Error('Telegram 未設定');
 const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text:text.slice(0,4000)}),signal:AbortSignal.timeout(15000)});
 const data=await r.json(); if(!r.ok || !data.ok) throw new Error('Telegram 發送失敗');
}
export async function processUpdate(raw:unknown) {
 const parsed=updateSchema.safeParse(raw);
 // Ignore groups, channel messages and unsupported media, without touching data.
 if(!parsed.success || !parsed.data.message) return;
 const {update_id:id,message:m}=parsed.data;
 if(m.chat.id!==m.from.id) return;
 const chat=String(m.chat.id), text=m.text.trim(),db=createAdminClient();
 const start=text.match(/^\/start ([a-f0-9]{48})$/);
 if(start) {
  const {data,error}=await db.rpc('telegram_bind',{p_hash:createHash('sha256').update(start[1]).digest('hex'),p_chat:chat});
  if(error) throw new Error('綁定服務失敗');
  await sendTelegram(chat,data?'已綁定。請傳見客紀錄，整理後會請你確認。':'連結已失效，請登入 CRM 重新產生。');return;
 }
 const {data:link,error:linkError}=await db.from('telegram_links').select('owner_id').eq('chat_id',chat).maybeSingle();
 if(linkError) throw new Error('身份查詢失敗');
 if(!link) {await sendTelegram(chat,'請先登入 CRM 的「Telegram 助理」頁綁定帳戶。');return;}
 const {data:profile,error:pe}=await db.from('profiles').select('active').eq('id',link.owner_id).single();
 if(pe || !profile?.active) {await sendTelegram(chat,'帳戶未啟用，請聯絡主管。');return;}
 const choice=decision(text);
 if(choice) {
  const {data,error}=await db.rpc('telegram_decide',{p_owner:link.owner_id,p_id:choice.id,p_confirm:choice.confirm});
  if(error) {await sendTelegram(chat,'未能確認儲存，請使用同一編號重試；不要重新提交紀錄。');return;}
  await sendTelegram(chat,data==='confirmed'?'已保存至 CRM 團隊更新，Ryan 可以查看。':'已取消，沒有寫入團隊更新。');return;
 }
 if(text.startsWith('/')) {await sendTelegram(chat,'傳見客文字後，回覆「確認 編號」或「取消 編號」。');return;}
 const {data:existing,error:ee}=await db.from('telegram_drafts').select('payload,status,owner_id').eq('id',id).maybeSingle();
 if(ee) throw new Error('草稿查詢失敗');
 if(existing && existing.owner_id!==link.owner_id) throw new Error('草稿身份不符');
 if(existing?.status && existing.status!=='pending') return;
 let value;
 if(existing) value=openUpdate(id,existing.payload);
 else {
  const extraction=await extractFromMessage(text,hkToday());
  value={original:text,extraction};
  const {error}=await db.from('telegram_drafts').insert({id,owner_id:link.owner_id,payload:sealUpdate(id,value)});
  if(error) throw new Error('草稿未保存，請稍後重試');
 }
 await sendTelegram(chat,`待確認 #${id}\n${value.extraction.summary}\n客戶：${value.extraction.client.name || '未提供'}\n\n${value.extraction.fields.map((f:{text:string})=>f.text).join('\n').slice(0,2200)}\n\n原文及整理結果會保存到團隊更新；未自動修改客戶卡、業績或日曆。\n回覆「確認 ${id}」或「取消 ${id}」。`);
}

export async function deliverNotifications(){
 const db=createAdminClient();const {data,error}=await db.from('telegram_notifications').select('update_id,recipient').eq('delivered',false).limit(20);if(error)throw new Error('通知查詢失敗');
 for(const n of data||[]){
  const {data:p}=await db.from('profiles').select('active,role').eq('id',n.recipient).single();
  const {data:l}=await db.from('telegram_links').select('chat_id').eq('owner_id',n.recipient).single();
  if(!p?.active||p.role!=='admin'||!l?.chat_id)continue;
  await sendTelegram(l.chat_id,`有同事更新 #${n.update_id}。請登入 CRM「Telegram 助理」查看。`);
  const {error:e}=await db.from('telegram_notifications').update({delivered:true}).eq('update_id',n.update_id).eq('recipient',n.recipient);if(e)throw new Error('通知回執未確認');
 }
}
