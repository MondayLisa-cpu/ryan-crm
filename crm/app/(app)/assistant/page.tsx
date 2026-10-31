import {requireUser} from '@/lib/auth';
import {openUpdate} from '@/lib/telegram/service';
import {addTraining,updateTraining} from './actions';
import TelegramBinding from '@/components/TelegramBinding';
export const dynamic='force-dynamic';
export default async function Assistant(){
 const {supabase,profile}=await requireUser();
 const {data,error}=await supabase.from('team_updates').select('id,owner_id,payload,created_at').order('id',{ascending:false}).limit(100);
 const {data:training,error:trainingError}=await supabase.from('training_items').select('*').order('created_at',{ascending:false}).limit(100);
 const {data:people}=await supabase.from('profiles').select('id,full_name');
 return <div><h1>Telegram 團隊助理</h1><p>見客後傳訊息 → 檢閱摘要 → 確認或取消 → 主管查看更新。</p>
 <section className="card"><h2>連接我的 Telegram</h2><TelegramBinding/><p>只處理已綁定帳戶的私人訊息。確認後會保存獨立紀錄，不自動覆寫客戶卡或計作成交。</p></section>
 <section className="card"><h2>{profile.role==='admin'?'全隊最新更新':'我的最新更新'}</h2><p>顯示最近 100 項，重新整理取得最新內容。</p>
 {error?<p role="alert">團隊更新未能載入。請由管理員檢查 migration 0007 及權限。</p>:!data?.length?<p>暫時未有已確認更新。</p>:data.map(row=>{
 let note;try{note=openUpdate(row.id,row.payload);}catch{return <p key={row.id}>紀錄 #{row.id} 無法解密，請檢查原本加密鑰匙。</p>;}
 return <article key={row.id}><h3>{people?.find(p=>p.id===row.owner_id)?.full_name||'同事'} · {new Date(row.created_at).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong'})}</h3><p>{note.extraction.summary}</p><p>客戶：{note.extraction.client.name||'未提供'}</p><pre style={{whiteSpace:'pre-wrap'}}>{note.original}</pre><details><summary>整理欄位</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(note.extraction,null,2)}</pre></details></article>;
 })}</section><section className="card"><h2>培訓進度</h2><p>由主管指派、本人或主管確認進度；不會從見客紀錄自動推斷完成。</p>{trainingError&&<p role="alert">培訓未能載入，請檢查資料庫設定。</p>}{profile.role==='admin'&&<form action={addTraining}><label>同事<select name="owner" required>{people?.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><label>培訓主題（請勿填客戶資料）<input name="topic" required maxLength={200}/></label><button>新增培訓</button></form>}{training?.map(t=><form key={t.id} action={updateTraining}><input type="hidden" name="id" value={t.id}/><p>{people?.find(p=>p.id===t.owner_id)?.full_name} · {t.topic}</p><label>進度<select name="status" defaultValue={t.status}><option value="planned">待開始</option><option value="in_progress">進行中</option><option value="completed">已完成</option></select></label><button>確認更新進度</button></form>)}</section><section className="card"><h2>Google 電郵與日程</h2><p>Gmail 與 Calendar 需要 Ryan 本人授權。</p>{profile.role==='admin'&&<a href="/assistant/google">開啟電郵與日程</a>}</section></div>;
}
