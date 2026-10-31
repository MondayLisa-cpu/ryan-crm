import {randomBytes,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {requireAdmin} from '@/lib/auth';
import {googleConfig} from '@/lib/google/service';
import {encryptValue,parseKey} from '@/lib/crypto';
export async function GET(){
 const {user}=await requireAdmin();
 try{
 const c=googleConfig(),state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 const jar=await cookies();
 jar.set('google_oauth',encryptValue(parseKey(process.env.DATA_ENCRYPTION_KEY),'google-oauth',JSON.stringify({state,verifier,owner:user.id,expires:Date.now()+600000})),{httpOnly:true,sameSite:'lax',secure:c.redirect.startsWith('https:'),maxAge:600,path:'/api/google'});
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:c.id,redirect_uri:c.redirect,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events',access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return Response.redirect(url);
 }catch{return new Response('Google 未設定或加密鑰匙缺少，請完成本機設定。',{status:503});}
}
