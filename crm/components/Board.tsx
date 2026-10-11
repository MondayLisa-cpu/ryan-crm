"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { moveSeasonAction, moveStageAction, unsignAction } from "@/app/(app)/clients/actions";
import { GENDERS, STAGES, missingChecks, type Checks, type Stage } from "@/lib/stages";
import { NO_SEASON, SIGNED_ZONE, type SeasonColumn } from "@/lib/seasons";

export type BoardCard = {
  id: string;
  stage: Stage;
  season: SeasonColumn;
  ready: boolean;
  checks: Checks;
  name: string;
  age: string;
  gender: string;
  occupation: string;
};

const genderLabel = (g: string) => GENDERS.find((x) => x.value === g)?.label ?? "";

function CardBody({ c }: { c: BoardCard }) {
  const missing = missingChecks(c.checks);
  const meta = [c.age && `${c.age}歲`, genderLabel(c.gender), c.occupation].filter(Boolean).join(" · ");
  return (
    <>
      <div className="row">
        <span className="name">{c.name || "（未命名）"}</span>
        <span className="spacer" />
        {c.ready ? (
          <span className="badge badge-green">✓ 具備簽單條件</span>
        ) : (
          <span className="badge badge-yellow">仲差 {missing.length} 格</span>
        )}
      </div>
      {meta && <div className="meta">{meta}</div>}
      {!c.ready && missing.length <= 3 && (
        <div className="missing">差：{missing.map((m) => `${m.stage}・${m.label}`).join("、")}</div>
      )}
    </>
  );
}

function DraggableCard({ c, readOnly }: { c: BoardCard; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id, disabled: readOnly });
  return (
    <Link
      href={`/clients/${c.id}`}
      ref={setNodeRef}
      className={`client-card${c.ready ? " ready" : ""}${isDragging ? " dragging" : ""}`}
      data-testid="client-card"
      {...(readOnly ? {} : listeners)}
      {...(readOnly ? {} : attributes)}
    >
      <CardBody c={c} />
    </Link>
  );
}

function Column({ col, cards, readOnly }: { col: BoardColumn; cards: BoardCard[]; readOnly: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, disabled: readOnly });
  return (
    <section ref={setNodeRef} className={`column${isOver ? " over" : ""}${col.done ? " column-done" : ""}`} data-stage={col.key}>
      <div className="column-head">
        <span>{col.label}</span>
        <span className="badge badge-grey">{cards.length}</span>
      </div>
      {col.hint && <p className="column-hint">{col.hint}</p>}
      {cards.map((c) => (
        <DraggableCard key={c.id} c={c} readOnly={readOnly} />
      ))}
      {cards.length === 0 && <p className="muted small" style={{ padding: "0 6px" }}>（冇）</p>}
    </section>
  );
}

export type BoardColumn = { key: string; label: string; hint?: string; done?: boolean };

const STAGE_COLUMNS: BoardColumn[] = STAGES.map((s) => ({
  key: s.key,
  label: s.short,
  done: s.key === "SIGNED" || s.key === "ISSUED",
}));

/** 看板：groupBy="stage" 按階段（預設），groupBy="season" 按四季 */
export default function Board({
  cards: initial,
  readOnly = false,
  groupBy = "stage",
  columns = STAGE_COLUMNS,
}: {
  cards: BoardCard[];
  readOnly?: boolean;
  groupBy?: "stage" | "season";
  columns?: BoardColumn[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  useEffect(() => setCards(initial), [initial]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; href?: string; link?: string } | null>(null);
  const [, startTransition] = useTransition();

  const isSigned = (c: BoardCard) => c.stage === "SIGNED" || c.stage === "ISSUED";
  // 四季頁：已簽／已出單嘅客放喺「已簽」欄，其他按季節
  const colOf = (c: BoardCard): string => (groupBy === "stage" ? c.stage : isSigned(c) ? SIGNED_ZONE : c.season);

  // 滑鼠拖 6px 先算拖；手機長按 250ms 先開始拖，避免同捲動打交
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const run = (prev: BoardCard[], fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setCards(prev);
        setError(res.error ?? "儲存失敗");
      } else {
        after?.();
        router.refresh();
      }
    });

  const confirmNotReady = (card: BoardCard, label: string) =>
    card.ready ||
    window.confirm(`「${card.name}」仲差 ${missingChecks(card.checks).length} 格先具備簽單條件，確定移去「${label}」？`);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id) : undefined;
    const card = cards.find((c) => c.id === id);
    if (!card || !to || colOf(card) === to) return;
    const prev = cards;
    setError(null);
    setNotice(null);

    if (groupBy === "stage") {
      if ((to === "SIGNED" || to === "ISSUED") && !confirmNotReady(card, STAGES.find((s) => s.key === to)?.short ?? to)) return;
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: to as Stage } : c)));
      return run(prev, () => moveStageAction(id, to));
    }

    // 四季頁：拖去「已簽」= 簽咗單
    if (to === SIGNED_ZONE) {
      if (!confirmNotReady(card, "已簽")) return;
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: "SIGNED" } : c)));
      return run(
        prev,
        () => moveStageAction(id, "SIGNED"),
        () => setNotice({ text: `🎉「${card.name}」已簽！`, href: `/business?add=${id}`, link: "加入本月生意表 →" }),
      );
    }

    // 由「已簽」拖返出去 = 撤回已簽（階段改返 PC）
    if (isSigned(card)) {
      if (!window.confirm(`撤回「${card.name}」嘅已簽狀態？階段會改返做 PC。`)) return;
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: "PC", season: to as SeasonColumn } : c)));
      return run(prev, () => unsignAction(id, to === NO_SEASON ? null : to));
    }

    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, season: to as SeasonColumn } : c)));
    run(prev, () => moveSeasonAction(id, to === NO_SEASON ? null : to));
  };

  const active = cards.find((c) => c.id === activeId);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {notice && (
        <p className="notice" data-testid="board-notice">
          {notice.text}{" "}
          {notice.href && <Link href={notice.href}>{notice.link}</Link>}
        </p>
      )}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="board">
          {columns.map((col) => (
            <Column key={col.key} col={col} cards={cards.filter((c) => colOf(c) === col.key)} readOnly={readOnly} />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className={`client-card drag-overlay${active.ready ? " ready" : ""}`}>
              <CardBody c={active} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
