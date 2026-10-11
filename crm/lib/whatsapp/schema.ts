// AI 由 WhatsApp 訊息抽出嚟嘅結構（同時用嚟做 JSON schema 同驗證）
import { z } from "zod";
import { ACTIVITY_KEYS } from "../activity";
import { CHECK_KEYS, FORMS, GENDERS, MARITAL, STAGE_KEYS } from "../stages";
import { SEASONS } from "../seasons";

/** 所有表格欄位，例如 "form_rr.family" */
export const FIELD_IDS = FORMS.flatMap((f) => [
  ...f.sections.flatMap((s) => s.fields.map((x) => `${f.column}.${x.key}`)),
  ...(f.checks?.items.flatMap((c) => (c.fill ? [`${f.column}.${c.fill.key}`] : [])) ?? []),
]);

export const APPT_KEYS = ["lunch", "tea", "dinner"] as const;

export const extractionSchema = z.object({
  client: z.object({
    name: z.string(),
    age: z.string(),
    gender: z.enum(["", ...GENDERS.map((g) => g.value)] as [string, ...string[]]),
    occupation: z.string(),
    marital: z.enum(["", ...MARITAL.map((m) => m.value)] as [string, ...string[]]),
  }),
  fields: z.array(z.object({ field: z.enum(FIELD_IDS as [string, ...string[]]), text: z.string() })),
  checks: z.array(z.enum(CHECK_KEYS as [string, ...string[]])),
  stage: z.enum(["", ...STAGE_KEYS] as [string, ...string[]]),
  season: z.enum(["", ...SEASONS.map((s) => s.key)] as [string, ...string[]]),
  activity: z.object(Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, z.number().int().min(0).max(20)])) as Record<
    (typeof ACTIVITY_KEYS)[number],
    z.ZodNumber
  >),
  appointment: z.object({ slot: z.enum(["", ...APPT_KEYS]), text: z.string() }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string(),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** 俾 Claude structured outputs 用嘅 JSON schema（全部欄位必填、唔准多餘 key） */
export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["client", "fields", "checks", "stage", "season", "activity", "appointment", "date", "summary"],
  properties: {
    client: {
      type: "object",
      additionalProperties: false,
      required: ["name", "age", "gender", "occupation", "marital"],
      properties: {
        name: { type: "string" },
        age: { type: "string" },
        gender: { type: "string", enum: ["", ...GENDERS.map((g) => g.value)] },
        occupation: { type: "string" },
        marital: { type: "string", enum: ["", ...MARITAL.map((m) => m.value)] },
      },
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "text"],
        properties: { field: { type: "string", enum: FIELD_IDS }, text: { type: "string" } },
      },
    },
    checks: { type: "array", items: { type: "string", enum: CHECK_KEYS } },
    stage: { type: "string", enum: ["", ...STAGE_KEYS] },
    season: { type: "string", enum: ["", ...SEASONS.map((s) => s.key)] },
    activity: {
      type: "object",
      additionalProperties: false,
      required: [...ACTIVITY_KEYS],
      properties: Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, { type: "integer" }])),
    },
    appointment: {
      type: "object",
      additionalProperties: false,
      required: ["slot", "text"],
      properties: { slot: { type: "string", enum: ["", ...APPT_KEYS] }, text: { type: "string" } },
    },
    date: { type: "string" },
    summary: { type: "string" },
  },
} as const;
