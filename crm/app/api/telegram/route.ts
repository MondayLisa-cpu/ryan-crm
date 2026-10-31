import { authorized } from '@/lib/telegram/protocol';
import { processUpdate } from '@/lib/telegram/service';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request) {
 if(!authorized(req.headers.get('x-telegram-bot-api-secret-token'),process.env.TELEGRAM_WEBHOOK_SECRET)) return new Response('Unauthorized',{status:401});
 const text=await req.text(); if(text.length>20000) return new Response('Too large',{status:413});
 let data;try{data=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
 try {await processUpdate(data);return Response.json({ok:true});}
 catch {return Response.json({ok:false,error:'處理未完成，請重試相同 update'},{status:503});}
}

// The local worker triggers delivery; protected by the same server-only secret.
export async function PUT(req:Request){
 if(!authorized(req.headers.get('x-telegram-bot-api-secret-token'),process.env.TELEGRAM_WEBHOOK_SECRET))return new Response('Unauthorized',{status:401});
 try{const {deliverNotifications}=await import('@/lib/telegram/service');await deliverNotifications();return Response.json({ok:true});}catch{return new Response('Notification retry required',{status:503});}
}
