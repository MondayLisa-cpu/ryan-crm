import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = () => process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v23.0";

/** 驗證 Meta 嘅 X-Hub-Signature-256（用 App Secret 簽） */
export function verifySignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** 回覆文字訊息（員工先 send 訊息，24 小時內可以自由回覆） */
export async function sendText(to: string, body: string): Promise<void> {
  const res = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000) } }),
  });
  if (!res.ok) console.error("WhatsApp send failed", res.status, await res.text().catch(() => ""));
}
