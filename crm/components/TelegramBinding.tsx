'use client';
import {useState,useTransition} from 'react';
import {bindTelegram} from '@/app/(app)/assistant/actions';
export default function TelegramBinding(){
 const [result,setResult]=useState<{url?:string;error?:string}>({});const [pending,start]=useTransition();
 return <div><button disabled={pending} onClick={()=>start(async()=>{try{setResult(await bindTelegram());}catch{setResult({error:'建立失敗，請重新登入後再試。'});}})}>{pending?'建立中…':'產生我的 Telegram 綁定連結'}</button><div role="status">{result.error}{result.url&&<p><a href={result.url} target="_blank" rel="noreferrer">開啟 Telegram 並按 Start（10 分鐘內有效）</a></p>}</div></div>;
}
