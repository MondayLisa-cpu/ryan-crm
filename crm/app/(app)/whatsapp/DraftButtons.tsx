"use client";

import { useState, useTransition } from "react";
import { decideDraftAction, type DraftResult } from "./actions";

export default function DraftButtons({ id }: { id: string }) {
  const [res, setRes] = useState<DraftResult | null>(null);
  const [pending, start] = useTransition();
  const go = (d: "apply" | "cancel") => start(async () => setRes(await decideDraftAction(id, d)));
  return (
    <div className="row">
      <button className="btn btn-primary btn-sm" disabled={pending || res?.ok} onClick={() => go("apply")}>
        確認儲存
      </button>
      <button className="btn btn-sm" disabled={pending || res?.ok} onClick={() => go("cancel")}>
        取消
      </button>
      {res && <span className={res.ok ? "notice" : "error"}>{res.message}</span>}
    </div>
  );
}
