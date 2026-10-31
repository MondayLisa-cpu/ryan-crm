'use server';
import {z} from 'zod';
import {requireAdmin} from '@/lib/auth';
import {googleFetch} from '@/lib/google/service';
import {createAdminClient} from '@/lib/supabase/admin';
import {redirect} from 'next/navigation';
const event=z.object({id:z.string().regex(/^[0-9a-f]{32}$/),title:z.string().trim().min(1).max(200),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),confirm:z.literal('yes')}).refine(v=>Date.parse(v.end)>Date.parse(v.start));
export async function createEvent(form:FormData){
 const {user}=await requireAdmin();
 const p=event.safeParse(Object.fromEntries(form));if(!p.success)throw new Error('請確認標題、含時區的開始／結束時間，並勾選確認。');
 const v=p.data;
 // A stable form ID prevents duplicate events on double submit / uncertain retry.
 const r=await googleFetch(user.id,'calendar/v3/calendars/primary/events?sendUpdates=none',{method:'POST',body:JSON.stringify({id:v.id,summary:v.title,start:{dateTime:v.start},end:{dateTime:v.end}})});
 if(r.status===409){const existing=await googleFetch(user.id,`calendar/v3/calendars/primary/events/${v.id}`);if(!existing.ok)throw new Error('事件狀態未確認');}
 redirect('/assistant/google');
}
export async function disconnect(){const {user}=await requireAdmin();const {error}=await createAdminClient().from('google_connections').delete().eq('owner_id',user.id);if(error)throw new Error('解除連接失敗');redirect('/assistant/google');}
