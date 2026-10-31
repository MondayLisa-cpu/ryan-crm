import 'server-only';
import {createAdminClient} from '../supabase/admin';
import {encryptValue,decryptValue,parseKey} from '../crypto';
export function googleConfig(){
 const id=process.env.GOOGLE_CLIENT_ID,secret=process.env.GOOGLE_CLIENT_SECRET,redirect=process.env.GOOGLE_REDIRECT_URI;
 if(!id||!secret||!redirect)throw new Error('Google OAuth 未設定');
 const url=new URL(redirect);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new Error('Google redirect 必須使用 HTTPS 或本機 loopback');
 return {id,secret,redirect};
}
export async function exchange(params:Record<string,string>){
 const c=googleConfig();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:c.id,client_secret:c.secret}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Google 授權已失效或未完成，請重新連接');
 return await r.json() as {access_token:string;refresh_token?:string};
}
export async function saveConnection(owner:string,refresh:string){
 const payload=encryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),`google:${owner}`,refresh);
 const {error}=await createAdminClient().from('google_connections').upsert({owner_id:owner,payload});if(error)throw new Error('未能保存 Google 授權');
}
export async function googleFetch(owner:string,path:string,init?:RequestInit){
 const {data,error}=await createAdminClient().from('google_connections').select('payload').eq('owner_id',owner).maybeSingle();
 if(error||!data)throw new Error('請先連接 Google');
 const refresh=decryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),`google:${owner}`,data.payload);
 const token=await exchange({grant_type:'refresh_token',refresh_token:refresh});
 const r=await fetch(`https://www.googleapis.com/${path}`,{...init,headers:{...init?.headers,Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok&&r.status!==409)throw new Error('Google 請求未完成，請檢查授權');
 return r;
}
