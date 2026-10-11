"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [error, action, pending] = useActionState(signIn, initialError ?? null);
  return (
    <form action={action}>
      <label className="field">
        <span>電郵</span>
        <input type="email" name="email" autoComplete="username" required />
      </label>
      <label className="field">
        <span>密碼</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={pending}>
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
