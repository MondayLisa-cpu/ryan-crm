import {cookies} from 'next/headers';
import {requireAdmin} from '@/lib/auth';
import {decryptValue,parseKey} from '@/lib/crypto';
import {exchange,googleConfig,saveConnection} from '@/lib/google/service';
export async function GET(req:Request){
 const {user}=await requireAdmin();const jar=await cookies();const value=jar.get('google_oauth')?.value;jar.delete({name:'google_oauth',path:'/api/google'});
 try{
 if(!value)throw new Error();const state=JSON.parse(decryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),'google-oauth',value));const p=new URL(req.url).searchParams;
 if(state.owner!==user.id||state.expires<Date.now()||p.get('state')!==state.state||!p.get('code')||p.has('error'))throw new Error();
 const token=await exchange({grant_type:'authorization_code',code:p.get('code')!,redirect_uri:googleConfig().redirect,code_verifier:state.verifier});
 if(!token.refresh_token)throw new Error();await saveConnection(user.id,token.refresh_token);
 return Response.redirect(new URL('/assistant/google',googleConfig().redirect));
 }catch{return new Response('Google 連接未完成。請返回 CRM 重新連接；未顯示任何憑證。',{status:400});}
}
