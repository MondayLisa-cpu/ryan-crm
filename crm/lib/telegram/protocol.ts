import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const updateSchema = z.object({
 update_id: z.number().int().nonnegative().safe(),
 message: z.object({chat:z.object({id:z.number().int().safe(),type:z.literal('private')}),
 from:z.object({id:z.number().int().safe(),is_bot:z.literal(false)}),text:z.string().min(1).max(4000)}).optional(),
});
export function authorized(actual:string|null,expected:string|undefined) {
 if (!actual || !expected || expected.length<32) return false;
 const a=Buffer.from(actual), b=Buffer.from(expected);
 return a.length===b.length && timingSafeEqual(a,b);
}
export function decision(text:string) {
 const m=text.trim().match(/^(確認|取消)\s+(\d{1,16})$/);
 if(!m || !Number.isSafeInteger(Number(m[2]))) return null;
 return {id:Number(m[2]),confirm:m[1]==='確認'};
}
