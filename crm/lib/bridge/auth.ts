import { verify } from "node:crypto";
import { PUBLIC_KEY } from "./public-key";

export type Identity = { id: string; role: "admin" | "agent"; phone: string; messageId: string };
export class BridgeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
/** Only the local inbound bridge can issue these short-lived capabilities. */
export function authenticate(header: string | null, now = Date.now() / 1000, publicKey = PUBLIC_KEY): Identity {
  try {
    const token = header?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
    if (!token || token.length > 4096) throw new Error();
    const [body, signature] = token.split(".");
    if (!verify(null, Buffer.from(body), publicKey, Buffer.from(signature, "base64url"))) throw new Error();
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    if (c.aud !== "ryan-crm-whatsapp-v1" || !Number.isInteger(c.iat) || !Number.isInteger(c.exp) ||
        c.iat > now + 30 || c.exp <= now || c.exp - c.iat > 1500 || c.exp <= c.iat ||
        typeof c.phone !== "string" || typeof c.messageId !== "string" || !c.messageId || c.messageId.length > 512) throw new Error();
    if (typeof c.sub !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.sub) ||
        !/^[0-9]{8,15}$/.test(c.phone) || !["admin","agent"].includes(c.role)) throw new Error();
    return { id: c.sub, role: c.role, phone: c.phone, messageId: c.messageId };
  } catch { throw new BridgeError(401, "WhatsApp 身份驗證失敗或已過期"); }
}
