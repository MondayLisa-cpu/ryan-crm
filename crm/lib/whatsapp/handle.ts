import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../supabase/admin";
import { addDays, hkToday, isDate } from "../weeks";
import { AiRefusal, extractFromMessage } from "./ai";
import { applyDraft, describeDraft, hasContent, loadClientNames, matchClient, type Draft } from "./apply";
import { latestPending, reopen, sealDraft, setStatus } from "./drafts";
import { sendText } from "./send";

export type Incoming = { from: string; messageId: string; type: string; text: string };

const HELP = `👋 我係團隊跟客助手。
見完客之後，直接打字話我知見客內容，例如：
「今日同陳大文食午餐，35歲會計師，已婚有個仔。佢好信任我，月入5萬，想幫個仔儲教育基金。開咗口，下星期三再見」

我會整理好再問你確認，回覆「確認」就會寫入 app。
指令：確認／取消／幫助`;

const CONFIRM = /^(確認|确认|confirm|ok|yes|1)$/i;
const CANCEL = /^(取消|cancel|no|2)$/i;
const HELPCMD = /^(幫助|帮助|help|\?|？)$/i;
const MERGE_WINDOW_MS = 2 * 3600_000; // 2 小時內嘅補充訊息會併入同一份草稿

const appUrl = () =>
  process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");

export async function handleIncoming(msg: Incoming): Promise<void> {
  const admin = createAdminClient();

  // Meta 會重送：同一個訊息只處理一次
  const { error: dupErr } = await admin.from("wa_seen_messages").insert({ message_id: msg.messageId });
  if (dupErr) return;

  const { data: agent } = await admin
    .from("profiles")
    .select("id, full_name, active")
    .eq("whatsapp", msg.from)
    .maybeSingle();
  if (!agent || !agent.active) {
    await sendText(msg.from, "呢個 WhatsApp 號碼未登記，或者帳戶已停用。請搵主管喺「員工帳戶」設定你嘅 WhatsApp 號碼。");
    return;
  }

  if (msg.type !== "text") {
    await sendText(msg.from, "暫時只收文字訊息 🙏 可以用手機鍵盤嘅🎤語音輸入轉做文字再 send。");
    return;
  }

  const text = msg.text.trim().slice(0, 4000);
  if (!text || HELPCMD.test(text)) {
    await sendText(msg.from, HELP);
    return;
  }

  const pending = await latestPending(admin, agent.id);

  if (CONFIRM.test(text)) {
    if (!pending) return sendText(msg.from, "冇未確認嘅內容。直接講見客內容就得 🙂");
    if (pending.draft.target.mode === "ambiguous")
      return sendText(msg.from, `仲未知係邊個客（${pending.draft.target.candidates.join("、")}），請先講全名。`);
    if (!(await setStatus(admin, pending.id, "applied"))) return;
    try {
      await applyDraft(admin, agent.id, pending.draft);
    } catch (e) {
      await reopen(admin, pending.id);
      return sendText(msg.from, `⚠️ 儲存失敗：${(e as Error).message}\n可以再回覆「確認」試多次。`);
    }
    const t = pending.draft.target;
    const link = t.mode === "existing" || t.mode === "new" ? `${appUrl()}/clients/${t.id}` : `${appUrl()}/activity`;
    return sendText(msg.from, `✅ 已儲存${t.mode === "existing" || t.mode === "new" ? `到「${t.name}」` : ""}。\n${link}`);
  }

  if (CANCEL.test(text)) {
    if (pending && (await setStatus(admin, pending.id, "cancelled"))) return sendText(msg.from, "已取消，冇儲存任何嘢。");
    return sendText(msg.from, "冇未確認嘅內容。");
  }

  // 新內容（或者補充上一份未確認嘅內容）
  const recent = pending && Date.now() - new Date(pending.created_at).getTime() < MERGE_WINDOW_MS ? pending : null;
  const texts = [...(recent?.draft.texts ?? []), text];
  const today = hkToday();

  let extraction;
  try {
    extraction = await extractFromMessage(texts.join("\n\n"), today);
  } catch (e) {
    console.error("AI extraction failed", e);
    return sendText(
      msg.from,
      e instanceof AiRefusal ? "⚠️ 呢段內容處理唔到，請換個講法再試。" : "⚠️ 整理時出錯，請遲啲再試，或者直接喺 app 填。",
    );
  }
  // 日期只接受今日前後 60 日內，否則當今日
  if (!isDate(extraction.date) || extraction.date < addDays(today, -60) || extraction.date > addDays(today, 60)) extraction.date = today;

  const clients = await loadClientNames(admin, agent.id);
  const prevTarget = recent?.draft.target;
  const target =
    extraction.client.name.trim() !== ""
      ? matchClient(extraction.client.name, clients)
      : prevTarget && prevTarget.mode !== "ambiguous"
        ? prevTarget
        : { mode: "none" as const };
  // 補充訊息配對到同一個新客時，沿用之前嘅 id
  if (target.mode === "new" && prevTarget?.mode === "new" && prevTarget.name === target.name) target.id = prevTarget.id;

  const draft: Draft = { texts, today, extraction, target };

  if (target.mode === "ambiguous") {
    await saveDraft(admin, agent.id, draft, recent?.id);
    return sendText(msg.from, `搵到幾個相似嘅客：${target.candidates.join("、")}。請講返全名，我再幫你整理。`);
  }
  if (!hasContent(draft)) {
    return sendText(msg.from, `我搵唔到可以記錄嘅內容 🤔\n${HELP}`);
  }
  await saveDraft(admin, agent.id, draft, recent?.id);
  await sendText(msg.from, describeDraft(draft));
}

async function saveDraft(admin: ReturnType<typeof createAdminClient>, ownerId: string, draft: Draft, replaces?: string) {
  if (replaces) await setStatus(admin, replaces, "cancelled");
  const id = randomUUID();
  const { error } = await admin.from("wa_drafts").insert({ id, owner_id: ownerId, payload: sealDraft(id, draft) });
  if (error) throw new Error(error.message);
}
