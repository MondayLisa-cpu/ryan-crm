import {describe,it,expect} from 'vitest';
import {authorized,decision,updateSchema} from '../../lib/telegram/protocol';
describe('Telegram trust boundary',()=>{
 it('requires configured nonempty strong shared secret',()=>{expect(authorized(null,undefined)).toBe(false);expect(authorized('abc','abc')).toBe(false);expect(authorized('a'.repeat(32),'a'.repeat(32))).toBe(true);expect(authorized('a'.repeat(31),'a'.repeat(32))).toBe(false);expect(authorized('b'.repeat(32),'a'.repeat(32))).toBe(false);});
 it('requires explicit draft ID for decisions',()=>{expect(decision('確認')).toBeNull();expect(decision('確認 123')).toEqual({id:123,confirm:true});expect(decision('取消 123')).toEqual({id:123,confirm:false});expect(decision('確認 9999999999999999')).toBeNull();});
 it('rejects group and bot messages',()=>{const value={update_id:1,message:{chat:{id:5,type:'private'},from:{id:5,is_bot:false},text:'見客'}};expect(updateSchema.safeParse(value).success).toBe(true);expect(updateSchema.safeParse({...value,message:{...value.message,chat:{id:-1,type:'group'}}}).success).toBe(false);expect(updateSchema.safeParse({...value,message:{...value.message,from:{id:5,is_bot:true}}}).success).toBe(false);});
});
