import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptMap, decryptValue, encryptValue, mergeEncrypted, parseKey } from "@/lib/crypto";

const key = randomBytes(32);

describe("加密", () => {
  it("加密後可以還原，密文唔包含原文", () => {
    const t = encryptValue(key, "id1:info.name", "陳大文");
    expect(t.startsWith("v1.")).toBe(true);
    expect(t).not.toContain("陳大文");
    expect(decryptValue(key, "id1:info.name", t)).toBe("陳大文");
  });

  it("同一個值每次密文都唔同（隨機 IV）", () => {
    expect(encryptValue(key, "a", "x")).not.toBe(encryptValue(key, "a", "x"));
  });

  it("搬去其他客／其他欄位會解密失敗", () => {
    const t = encryptValue(key, "id1:info.name", "陳大文");
    expect(() => decryptValue(key, "id2:info.name", t)).toThrow();
    expect(() => decryptValue(key, "id1:info.occupation", t)).toThrow();
  });

  it("錯鑰匙或者被改過嘅密文會失敗", () => {
    const t = encryptValue(key, "a", "secret");
    expect(() => decryptValue(randomBytes(32), "a", t)).toThrow();
    const parts = t.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptValue(key, "a", parts.join("."))).toThrow();
  });

  it("parseKey 要求 32 bytes", () => {
    expect(() => parseKey(undefined)).toThrow();
    expect(() => parseKey(Buffer.alloc(16).toString("base64"))).toThrow();
    expect(parseKey(key.toString("base64")).length).toBe(32);
  });

  it("mergeEncrypted 只重新加密有改動嘅欄位，空白即刪除", () => {
    const first = mergeEncrypted(key, "c1", "form_rr", {}, { family: "已婚", work: "會計" });
    const second = mergeEncrypted(key, "c1", "form_rr", first, { family: "已婚", work: "核數", hobbies: "" });
    expect(second.family).toBe(first.family); // 冇改 → 密文不變
    expect(second.work).not.toBe(first.work);
    expect("hobbies" in second).toBe(false);
    expect(decryptMap(key, "c1", "form_rr", second)).toEqual({ family: "已婚", work: "核數" });
    const third = mergeEncrypted(key, "c1", "form_rr", second, { work: "  " });
    expect("work" in third).toBe(false);
  });
});
