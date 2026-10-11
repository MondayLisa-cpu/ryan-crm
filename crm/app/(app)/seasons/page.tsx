import Link from "next/link";
import Board, { type BoardColumn } from "@/components/Board";
import WideOpenDetails from "@/components/WideOpenDetails";
import { requireUser, displayName, type Profile } from "@/lib/auth";
import { listClientCards, toBoardCards } from "@/lib/data";
import { NO_SEASON, SEASONS, SIGNED_ZONE } from "@/lib/seasons";

const COLUMNS: BoardColumn[] = [
  { key: NO_SEASON, label: "未分類", hint: "拖去右邊四季" },
  ...SEASONS.map((s) => ({ key: s.key, label: `${s.emoji} ${s.label}`, hint: `${s.state} · ${s.focus}` })),
  { key: SIGNED_ZONE, label: "✍️ 已簽", hint: "簽得就拖嚟呢度", done: true },
];

export default async function SeasonsPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const { agent } = await searchParams;
  const { supabase, profile } = await requireUser();

  // 主管可以用 ?agent= 睇員工嘅四季（唯讀）；員工一律只睇自己
  let ownerId = profile.id;
  let owner: Pick<Profile, "full_name" | "email"> = profile;
  if (agent && agent !== profile.id && profile.role === "admin") {
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("id", agent).maybeSingle<Profile>();
    if (data) {
      ownerId = data.id;
      owner = data;
    }
  }
  const readOnly = ownerId !== profile.id;
  const cards = await listClientCards(supabase, ownerId);

  return (
    <>
      {readOnly && (
        <p className="small">
          <Link href={`/admin/agents/${ownerId}`}>← {displayName(owner)} 嘅看板</Link>
        </p>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{readOnly ? `${displayName(owner)} 嘅四季人脈` : "四季人脈"}</h1>
        <span className="badge badge-grey">{cards.length} 個客</span>
      </div>
      {readOnly ? (
        <p className="notice">👁 唯讀</p>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>
          拖拉卡片去對應季節；簽咗單就拖去最右「✍️ 已簽」（手機：長按卡片再拖）。撳卡片入去睇詳情。
        </p>
      )}

      <div className="season-legend">
        {SEASONS.map((s) => (
          <div key={s.key} className={`season-tile season-${s.key.toLowerCase()}`}>
            <div className="season-name">
              {s.emoji} {s.label}
              <span className="badge badge-grey">{cards.filter((c) => c.season === s.key).length}</span>
            </div>
            <div className="small">
              {s.state} → <b>{s.focus}</b>
            </div>
            {s.actions.length > 0 && (
              <WideOpenDetails summary={`行動清單（${s.actions.length} 點）`}>
                <ol className="small">
                  {s.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ol>
              </WideOpenDetails>
            )}
          </div>
        ))}
      </div>

      <Board cards={toBoardCards(cards)} groupBy="season" columns={COLUMNS} readOnly={readOnly} />
    </>
  );
}
