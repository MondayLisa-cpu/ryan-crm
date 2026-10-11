import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM。每個值用獨立隨機 IV；AAD 綁定「記錄 ID + 欄位名」，
// 防止有人將一個客嘅密文搬去另一個客／另一個欄位。
const VERSION = "v1";

export function parseKey(b64: string | undefined): Buffer {
  if (!b64) throw new Error("DATA_ENCRYPTION_KEY 未設定");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY 必須係 32 bytes（base64）");
  return key;
}

export function encryptValue(key: Buffer, aad: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptValue(key: Buffer, aad: string, token: string): string {
  const [ver, iv, tag, ct] = token.split(".");
  if (ver !== VERSION || !iv || !tag || ct === undefined) throw new Error("密文格式錯誤");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export type EncMap = Record<string, string>;
export type PlainMap = Record<string, string>;

export function decryptMap(key: Buffer, recordId: string, column: string, enc: EncMap | null | undefined): PlainMap {
  const out: PlainMap = {};
  for (const [field, token] of Object.entries(enc ?? {})) {
    try {
      out[field] = decryptValue(key, `${recordId}:${column}.${field}`, token);
    } catch {
      out[field] = "⚠️（無法解密）";
    }
  }
  return out;
}

/**
 * 只重新加密有改動嘅欄位；冇改嘅保留原密文。
 * 咁資料庫審計 trigger 比較密文時，就會準確記低邊幾格改咗。
 * 空字串 = 刪除該欄位。
 */
export function mergeEncrypted(
  key: Buffer,
  recordId: string,
  column: string,
  existingEnc: EncMap | null | undefined,
  next: PlainMap,
): EncMap {
  const current = decryptMap(key, recordId, column, existingEnc);
  const out: EncMap = { ...(existingEnc ?? {}) };
  for (const [field, value] of Object.entries(next)) {
    const v = value.trim() === "" ? "" : value;
    if (v === "") {
      delete out[field];
    } else if (current[field] !== v) {
      out[field] = encryptValue(key, `${recordId}:${column}.${field}`, v);
    }
  }
  return out;
}
