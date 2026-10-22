import { describe, expect, it, vi } from "vitest";
import { taskInputSchema, summarizeTasks, type Task } from "@/lib/planner";
import { applyDraft, describeDraft, type Draft } from "@/lib/whatsapp/apply";
import { extractionSchema } from "@/lib/whatsapp/schema";
import { prepareTasks } from "@/lib/whatsapp/tasks";
import { encryptColumn } from "@/lib/secure";

const input = { day:"2026-10-23",category:"appointment" as const,stage:"needs" as const,name:"Mary",plan:"邀約了解需要" };
const message = { ...input, operation:"create" as const,status:"planned" as const,result:"" };
const draft: Draft = { texts:["今日邀約 Mary"],today:input.day,target:{mode:"none"},extraction:{
  client:{name:"",age:"",gender:"",occupation:"",marital:""},fields:[],checks:[],stage:"",season:"",
  activity:{r:0,n:0,a:0,rr:0,nr:0,pc:0},appointment:{slot:"",text:""},date:input.day,summary:"",tasks:[message],
}};
describe("daily plans", () => {
  it("rejects impossible dates and missing people", () => {
    expect(taskInputSchema.safeParse({...input,day:"2026-02-30"}).success).toBe(false);
    expect(taskInputSchema.safeParse({...input,name:" "}).success).toBe(false);
  });
  it("planned stage is not actual completion; cancelled work is not overdue", () => {
    const tasks = ["planned","done","blocked","cancelled"].map((status,i) => ({...input,id:String(i),owner_id:"a",status,result:"",updated_at:""}) as Task);
    expect(summarizeTasks(tasks,"2026-10-24")).toEqual({total:4,done:1,open:2,overdue:2});
    expect(describeDraft(draft)).toContain("未完成");
    expect(describeDraft(draft)).toContain("唔會改動客戶目前進度");
  });
  it("accepts multiple people and days while rejecting unknown stages", () => {
    expect(extractionSchema.parse({...draft.extraction,tasks:[message,{...message,name:"李太",day:"2026-10-24"}]}).tasks).toHaveLength(2);
    expect(() => extractionSchema.parse({...draft.extraction,tasks:[{...message,stage:"SIGNED"}]})).toThrow();
  });
  it("uses a single atomic task RPC and never writes client or activity data", async () => {
    const rpc=vi.fn().mockResolvedValue({error:null});
    const db={rpc} as any;
    await applyDraft(db,"owner",{...draft,taskItems:[{operation:"create",id:"task",day:input.day,category:input.category,stage:input.stage,status:"planned",info:{}}]},"draft-id");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("wa_save_tasks",expect.objectContaining({p_actor:"owner",p_draft:"draft-id"}));
    await expect(applyDraft(db,"owner",draft)).rejects.toThrow("重新提交");
  });
  it("refuses ambiguous updates and always scopes lookup to sender", async () => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32,7).toString("base64");
    const rows = ["a","b"].map(id => ({id,stage:"needs",info:encryptColumn(id,"info",{},{name:"Mary",plan:"邀約"})}));
    const eq=vi.fn(); const q:any={select:()=>q,eq}; eq.mockImplementation(()=>q); q.then=(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve);
    await expect(prepareTasks({from:()=>q} as any,"sender",[{...message,operation:"update",status:"done"}])).rejects.toThrow("唯一配對");
    expect(eq).toHaveBeenCalledWith("owner_id","sender");
  });
});
