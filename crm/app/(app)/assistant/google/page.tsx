import {randomUUID} from 'node:crypto';
import {requireAdmin} from '@/lib/auth';
import {googleFetch} from '@/lib/google/service';
import {createEvent,disconnect} from './actions';
export const dynamic='force-dynamic';
export default async function Google(){
 const {user}=await requireAdmin();let mails:{id:string;snippet:string}[]=[],events:{id:string;summary:string;start:{dateTime?:string;date?:string}}[]=[],error='';
 try{
 const list=await(await googleFetch(user.id,'gmail/v1/users/me/messages?maxResults=10&q=is%3Aunread')).json();
 mails=await Promise.all((list.messages||[]).map(async(m:{id:string})=>await(await googleFetch(user.id,`gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata`)).json()));
 const e=await(await googleFetch(user.id,`calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(new Date().toISOString())}`)).json();events=e.items||[];
 }catch(e){error=e instanceof Error?e.message:'載入失敗';}
 return <div><h1>Ryan 的 Gmail 與日程</h1><p><a href="/api/google/connect">連接／重新授權 Google</a> · <a href="/assistant">返回團隊更新</a></p>{error&&<p role="alert">{error}</p>}
 <section className="card"><h2>未讀電郵（最近 10 封）</h2><p>原郵件摘要，不是 AI 摘要。不標記已讀、不自動回覆。</p>{mails.map(m=><article key={m.id}><p>{m.snippet}</p></article>)}</section>
 <section className="card"><h2>未來日程（最近 20 項）</h2>{events.map(e=><p key={e.id}>{e.start.dateTime||e.start.date} · {e.summary}</p>)}</section>
 <section className="card"><h2>確認新增日程</h2><form action={createEvent}><input type="hidden" name="id" value={randomUUID().replaceAll('-','')}/><label>標題<input name="title" required maxLength={200}/></label><label>開始時間（香港時區）<input name="start" placeholder="2026-11-02T14:00:00+08:00" required/></label><label>結束時間（香港時區）<input name="end" placeholder="2026-11-02T15:00:00+08:00" required/></label><label><input type="checkbox" name="confirm" value="yes" required/>確認寫入我的 Google 日曆（不發邀請）</label><button type="submit">確認新增日程</button></form></section>
 <form action={disconnect}><button>移除本機 CRM 保存的 Google 授權</button></form><p>如要撤銷 Google 端權限，請到 Google 帳戶的第三方連接設定移除本應用程式。</p></div>;
}
