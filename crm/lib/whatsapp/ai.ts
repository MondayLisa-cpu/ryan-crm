import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ACTIVITIES } from "../activity";
import { ALL_CHECKS, FORMS, STAGES } from "../stages";
import { SEASONS } from "../seasons";
import { extractionJsonSchema, extractionSchema, type Extraction } from "./schema";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";

function fieldGuide(): string {
  return FORMS.map((f) => {
    const lines = f.sections.flatMap((s) => s.fields.map((x) => `  - ${f.column}.${x.key}：${x.label}${x.hint ? `（${x.hint}）` : ""}`));
    for (const c of f.checks?.items ?? []) if (c.fill) lines.push(`  - ${f.column}.${c.fill.key}：${c.label}（${c.fill.label}）`);
    return `${f.title}（${f.timing}）\n${lines.join("\n")}`;
  }).join("\n");
}

// 固定嘅 system prompt（唔包含任何日期或者個人資料，方便 prompt caching）
const SYSTEM = `你係香港一個保險經紀團隊嘅助手。員工見完客之後會喺 WhatsApp 用廣東話／中英夾雜講低見客內容，你要將內容整理成結構化資料，寫入團隊嘅跟客系統。

規則：
- 淨係用訊息入面明確講咗嘅資料；冇講就留空（字串用 ""、次數用 0、清單用 []），唔好估、唔好作。
- 欄位內容用繁體中文，簡潔、分點（每點一行，用「・」開頭），保留重要數字、名稱同原意。
- 一段內容可以分拆到幾個欄位；只填同內容有關嘅欄位。
- client.name：訊息講緊邊個客（例如「陳大文」「陳生」）。如果完全冇提到客，留空。age 只填數字。gender：M＝男、F＝女。marital：single 單身／dating 拍拖中／married 已婚／divorced 離婚／widowed 喪偶。
- checks：只列出訊息清楚顯示已經達到嘅簽單條件。
- stage：只有員工明確講咗客人去到邊個階段（例如「已經簽咗」→ SIGNED、「出咗單」→ ISSUED、「做埋 FNA」→ FNA）先填，否則留空。
- season：只有員工明確講咗四季分類先填。
- activity：今次訊息描述嘅活動次數。見客（Appointment）通常 a=1；建立信任／Ask Referral → rr；討論財策需要／開口 → nr；講解計劃書／成交 → pc；認識新人脈落紅簿 → n；Morning Routine／Training／Event → r。冇講就 0。
- appointment：如果講咗係午餐（12–2pm）、下午茶（3–5pm）或晚飯（7–9pm）約會，slot 填 lunch／tea／dinner，text 寫客名同地點等簡短資料。
- date：活動發生日期（YYYY-MM-DD）。用 user 訊息提供嘅「今日日期」計「今日」「琴日」「星期二」等；冇講就用今日。
- summary：用一兩句廣東話總結你整理咗乜。

表格欄位（field 用左邊嘅 id）：
${fieldGuide()}

簽單條件（checks）：
${ALL_CHECKS.map((c) => `  - ${c.key}：${c.label}`).join("\n")}

階段（stage）：${STAGES.map((s) => `${s.key}＝${s.short}`).join("、")}
四季（season）：${SEASONS.map((s) => `${s.key}＝${s.label}（${s.state}，${s.focus}）`).join("、")}
活動：${ACTIVITIES.map((a) => `${a.key}＝${a.code} ${a.label}`).join("、")}`;

export class AiRefusal extends Error {}

/** 將員工嘅 WhatsApp 訊息整理成結構化資料 */
export async function extractFromMessage(text: string, today: string): Promise<Extraction> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: extractionJsonSchema as unknown as Record<string, unknown> },
    },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `今日日期：${today}\n\n員工訊息：\n${text}` }],
  });

  if (response.stop_reason === "refusal") throw new AiRefusal("AI 拒絕處理呢段內容");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("AI 冇回應");
  return extractionSchema.parse(JSON.parse(block.text));
}
