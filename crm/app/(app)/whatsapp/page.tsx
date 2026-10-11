import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { describeDraft } from "@/lib/whatsapp/apply";
import { openDraft } from "@/lib/whatsapp/drafts";
import DraftButtons from "./DraftButtons";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "等你確認", cls: "badge-yellow" },
  applied: { label: "已儲存", cls: "badge-green" },
  cancelled: { label: "已取消", cls: "badge-grey" },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false });

export default async function WhatsappPage() {
  const { supabase, profile } = await requireUser();
  const [{ data: me }, { data: drafts }] = await Promise.all([
    supabase.from("profiles").select("whatsapp").eq("id", profile.id).single(),
    supabase
      .from("wa_drafts")
      .select("id, status, payload, created_at")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const bot = process.env.WHATSAPP_DISPLAY_NUMBER;

  return (
    <div className="narrow" style={{ maxWidth: 900 }}>
      <h1>WhatsApp 助手</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <ol className="steps">
          <li>
            用你登記咗嘅 WhatsApp（{me?.whatsapp ? <b>+{me.whatsapp}</b> : <span className="error">未登記，請搵主管設定</span>}）send 訊息去團隊助手
            {bot && (
              <>
                {" "}
                <a href={`https://wa.me/${bot.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <b>{bot}</b>
                </a>
              </>
            )}
            。
          </li>
          <li>見完客直接打字講內容（可以用手機鍵盤🎤語音輸入），例如：「今日同陳大文食午餐，35 歲會計師，已婚。佢好信任我，想幫個仔儲教育基金，開咗口，下星期三再見」。</li>
          <li>助手會整理好、列出會寫入邊幾格，你回覆「確認」先會儲存；「取消」就放棄。都可以喺下面確認。</li>
        </ol>
        <p className="muted small" style={{ marginBottom: 0 }}>
          長文字欄位會加喺原有內容後面（標日期），唔會覆蓋舊資料；簽單條件只會剔，唔會剔走。所有改動都有審計記錄（標明經 WhatsApp）。
        </p>
      </div>

      <h2>最近記錄</h2>
      {(drafts ?? []).length === 0 && <p className="muted">暫時冇</p>}
      {(drafts ?? []).map((d) => {
        const draft = openDraft(d.id, d.payload);
        const st = STATUS[d.status];
        const t = draft.target;
        return (
          <div className="card wa-draft" key={d.id} data-testid="wa-draft">
            <div className="row">
              <span className={`badge ${st.cls}`}>{st.label}</span>
              <span className="muted small">{fmt(d.created_at)}</span>
              <span className="spacer" />
              {d.status === "applied" && (t.mode === "existing" || t.mode === "new") && <Link href={`/clients/${t.id}`}>打開客戶卡 →</Link>}
            </div>
            <details>
              <summary className="small muted">你講嘅原文</summary>
              <div className="wa-text">{draft.texts.join("\n\n")}</div>
            </details>
            <div className="wa-text">
              {describeDraft(draft)
                .replace(/^📝 幫你整理咗（未儲存）：\n/, "")
                .replace(/\n回覆「確認」.*$/s, "")}
            </div>
            {d.status === "pending" && <DraftButtons id={d.id} />}
          </div>
        );
      })}
    </div>
  );
}
