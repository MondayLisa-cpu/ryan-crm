'use server';
import { randomBytes, createHash } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
export async function bindTelegram() {
 const {user}=await requireUser();
 const name=process.env.TELEGRAM_BOT_USERNAME;
 if(!name || !/^[A-Za-z0-9_]+$/.test(name)) return {error:'請先設定 TELEGRAM_BOT_USERNAME。'};
 const code=randomBytes(24).toString('hex');
 const {error}=await createAdminClient().from('telegram_links').upsert({owner_id:user.id,code_hash:createHash('sha256').update(code).digest('hex'),expires_at:new Date(Date.now()+600000).toISOString()},{onConflict:'owner_id'});
 if(error) return {error:'未能建立連結，請確認已安裝 migration 0007。'};
 return {url:`https://t.me/${name}?start=${code}`};
}

export async function addTraining(form:FormData){
 const {requireAdmin}=await import('@/lib/auth');const {revalidatePath}=await import('next/cache');
 const {supabase}=await requireAdmin();const owner=String(form.get('owner')||''),topic=String(form.get('topic')||'').trim();
 if(!/^[a-f0-9-]{36}$/i.test(owner)||!topic||topic.length>200)throw new Error('請選擇員工及填寫培訓主題');
 const {data:staff}=await supabase.from('profiles').select('id').eq('id',owner).eq('active',true).maybeSingle();if(!staff)throw new Error('員工未啟用');
 const {error}=await supabase.from('training_items').insert({owner_id:owner,topic});if(error)throw new Error('新增培訓未完成');revalidatePath('/assistant');
}
export async function updateTraining(form:FormData){
 const {supabase}=await requireUser();const {revalidatePath}=await import('next/cache');const status=String(form.get('status'));
 if(!['planned','in_progress','completed'].includes(status))throw new Error('狀態無效');
 const {data,error}=await supabase.from('training_items').update({status}).eq('id',String(form.get('id'))).select('id');if(error||!data?.length)throw new Error('未能更新培訓');revalidatePath('/assistant');
}
