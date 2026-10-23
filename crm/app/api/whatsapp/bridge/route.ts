import { NextResponse } from "next/server";
import { authenticate, BridgeError } from "@/lib/bridge/auth";
import { handleCommand } from "@/lib/bridge/handle";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"Cache-Control":"private, no-store"};
export function GET() {return NextResponse.json({service:"ryan-crm-whatsapp-bridge",version:1},{headers});}
export async function POST(request:Request) {
  try {
    const identity=authenticate(request.headers.get("authorization"));
    // Enforce a streamed limit even if Content-Length is absent or incorrect.
    const reader=request.body?.getReader();if(!reader) throw new BridgeError(400,"冇操作內容");
    const chunks:Uint8Array[]=[];let length=0;
    while(true) {const {value,done}=await reader.read();if(done) break;length+=value.length;if(length>65536) {await reader.cancel();throw new BridgeError(413,"操作內容太長");}chunks.push(value);}
    let command;try {command=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch {throw new BridgeError(400,"操作格式無效");}
    const result=await handleCommand(createAdminClient(),identity,command);
    return NextResponse.json(result,{headers});
  } catch(e) {
    return NextResponse.json({ok:false,error:e instanceof BridgeError?e.message:"CRM 連接失敗，未確認完成；請先查記錄"},{status:e instanceof BridgeError?e.status:503,headers});
  }
}
