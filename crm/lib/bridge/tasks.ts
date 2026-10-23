import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BridgeError, type Identity } from "./auth";
import type { Command } from "./schema";
import { loadTasks } from "../planner-data";
import { prepareTasks } from "../whatsapp/tasks";
import { sealDraft, openDraft } from "../whatsapp/drafts";
import { describeDraft, type Draft } from "../whatsapp/apply";
import { decryptColumn } from "../secure";
import { ACTIVITY_KEYS } from "../activity";
import { addDays, hkToday } from "../weeks";

type TaskCommand = Extract<Command,{action:"tasks_list"|"tasks_prepare"|"tasks_confirm"|"tasks_cancel"|"tasks_status"}>;
function check(error:unknown) { if(error) throw new BridgeError(503,"待辦服務未確認完成；請用同一草稿查核，唔好重新建立。"); }
export async function handleTaskCommand(db:SupabaseClient,identity:Identity,c:TaskCommand) {
  if(c.action==="tasks_list") {
    if(c.to<c.from||c.to>addDays(c.from,30)) throw new BridgeError(400,"每次最多查 31 日");
    if(identity.role!=="admin"&&c.owner_id&&c.owner_id!==identity.id) throw new BridgeError(403,"只可以查自己待辦");
    return {tasks:await loadTasks(db,c.from,c.to,identity.role==="admin"?c.owner_id:identity.id)};
  }
  if(c.action==="tasks_prepare") {
    const today=hkToday();
    if(c.tasks.some(t=>t.day<addDays(today,-60)||t.day>addDays(today,60))) throw new BridgeError(400,"待辦日期要喺今日前後 60 日內");
    let items;
    try {items=await prepareTasks(db,identity.id,c.tasks);} catch(e) {throw new BridgeError(400,e instanceof Error?e.message:"待辦未能配對");}
    const tasks=items.map((t,i)=>({...c.tasks[i],day:t.day,category:c.tasks[i].category,stage:t.stage as typeof c.tasks[number]["stage"],...decryptColumn(t.id,"info",t.info)}));
    const draft:Draft={texts:[],today,target:{mode:"none"},taskItems:items,extraction:{client:{name:"",age:"",gender:"",occupation:"",marital:""},fields:[],checks:[],stage:"",season:"",activity:Object.fromEntries(ACTIVITY_KEYS.map(k=>[k,0])) as Draft["extraction"]["activity"],appointment:{slot:"",text:""},date:today,summary:"每日待辦",tasks}};
    const id=randomUUID();
    const {error}=await db.from("wa_drafts").insert({id,owner_id:identity.id,status:"pending",payload:sealDraft(id,draft)});check(error);
    return {draft_id:id,saved:false,preview:describeDraft(draft)};
  }
  const {data:row,error}=await db.from("wa_drafts").select("id,owner_id,status,payload").eq("id",c.draft_id).eq("owner_id",identity.id).maybeSingle();check(error);
  if(!row) throw new BridgeError(404,"搵唔到你嘅草稿");
  let draft:Draft;
  try {draft=openDraft(row.id,row.payload);} catch {throw new BridgeError(400,"呢個唔係待辦草稿");}
  if(!draft.taskItems?.length) throw new BridgeError(400,"呢個唔係待辦草稿");
  if(c.action==="tasks_status") {
    const {data:receipt,error:receiptError}=await db.from("wa_task_receipts").select("draft_id").eq("draft_id",row.id).eq("owner_id",identity.id).maybeSingle();check(receiptError);
    return {draft_id:row.id,saved:!!receipt,status:receipt?"saved":row.status==="applied"?"unconfirmed":row.status,preview:describeDraft(draft)};
  }
  if(c.action==="tasks_cancel") {
    const {data,error}=await db.from("wa_drafts").update({status:"cancelled",decided_at:new Date().toISOString()}).eq("id",row.id).eq("owner_id",identity.id).eq("status","pending").select("id");check(error);
    if(!data?.length) throw new BridgeError(409,"草稿已處理，未能取消");
    return {ok:true,cancelled:true,draft_id:row.id};
  }
  if(row.status==="cancelled") throw new BridgeError(409,"草稿已取消");
  if(row.status==="pending") {
    const {data,error}=await db.from("wa_drafts").update({status:"applied",decided_at:new Date().toISOString()}).eq("id",row.id).eq("owner_id",identity.id).eq("status","pending").select("id");check(error);
    if(!data?.length) throw new BridgeError(409,"草稿狀態改變，請用同一草稿再查核");
  }
  // Retry the same confirmed draft safely; the database receipt is atomic with all task writes.
  const {error:saveError}=await db.rpc("wa_save_tasks",{p_actor:identity.id,p_draft:row.id,p_items:draft.taskItems});check(saveError);
  return {ok:true,draft_id:row.id,task_ids:draft.taskItems.map(t=>t.id)};
}
