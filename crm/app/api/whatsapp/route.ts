import { after, NextResponse, type NextRequest } from "next/server";
import { handleIncoming, type Incoming } from "@/lib/whatsapp/handle";
import { verifySignature } from "@/lib/whatsapp/send";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Meta 設定 webhook 時嘅驗證 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && token && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type WaMessage = { from: string; id: string; type: string; text?: { body: string } };
type WaPayload = { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };

/** 收 WhatsApp 訊息：先即刻回 200，之後喺背景處理（AI 整理要幾秒） */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return new NextResponse("bad signature", { status: 401 });
  }
  let payload: WaPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const messages: Incoming[] = (payload.entry ?? []).flatMap((e) =>
    (e.changes ?? []).flatMap((c) =>
      (c.value?.messages ?? []).map((m) => ({ from: m.from, messageId: m.id, type: m.type, text: m.text?.body ?? "" })),
    ),
  );
  if (messages.length) {
    after(async () => {
      for (const m of messages) {
        try {
          await handleIncoming(m);
        } catch (e) {
          console.error("WhatsApp handling failed", e);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
