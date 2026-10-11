"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="card">
      <h2 style={{ marginTop: 0 }}>更改密碼</h2>
      <label className="field">
        <span>新密碼</span>
        <input type="password" name="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        <span>再輸入一次</span>
        <input type="password" name="again" autoComplete="new-password" required />
      </label>
      {state && <p className={state.ok ? "notice" : "error"}>{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>
        更新密碼
      </button>
    </form>
  );
}
