"use client";

import { useActionState } from "react";
import { createClientAction } from "../actions";
import InfoFields from "@/components/InfoFields";

export default function NewClientForm() {
  const [error, action, pending] = useActionState(createClientAction, null);
  return (
    <form action={action} className="card">
      <InfoFields />
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "建立中…" : "建立客戶卡"}
      </button>
    </form>
  );
}
