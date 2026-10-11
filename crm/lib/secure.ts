import "server-only";
import { parseKey, decryptMap, mergeEncrypted, type EncMap, type PlainMap } from "./crypto";

let cached: Buffer | null = null;
function key(): Buffer {
  if (!cached) cached = parseKey(process.env.DATA_ENCRYPTION_KEY);
  return cached;
}

export function decryptColumn(recordId: string, column: string, enc: EncMap | null | undefined): PlainMap {
  return decryptMap(key(), recordId, column, enc);
}

export function encryptColumn(recordId: string, column: string, existing: EncMap | null | undefined, next: PlainMap): EncMap {
  return mergeEncrypted(key(), recordId, column, existing, next);
}
