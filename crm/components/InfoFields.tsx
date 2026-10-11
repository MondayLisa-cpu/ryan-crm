"use client";

import { GENDERS, MARITAL } from "@/lib/stages";

type Info = { name: string; age: string; gender: string; occupation: string; marital: string };

/** 基本資料欄位。冇 value/onChange 時係 uncontrolled（用喺新增表格）。 */
export default function InfoFields({
  value,
  onChange,
  disabled,
}: {
  value?: Info;
  onChange?: (v: Info) => void;
  disabled?: boolean;
}) {
  const bind = (k: keyof Info) =>
    value && onChange
      ? { value: value[k], onChange: (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value }) }
      : {};
  return (
    <div className="grid-2">
      <label className="field">
        <span>姓名 *</span>
        <input type="text" name="name" required maxLength={200} disabled={disabled} {...bind("name")} />
      </label>
      <label className="field">
        <span>年齡</span>
        <input type="number" name="age" min={0} max={120} inputMode="numeric" disabled={disabled} {...bind("age")} />
      </label>
      <label className="field">
        <span>性別</span>
        <select name="gender" disabled={disabled} {...bind("gender")}>
          <option value="">—</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>職業</span>
        <input type="text" name="occupation" maxLength={200} disabled={disabled} {...bind("occupation")} />
      </label>
      <label className="field">
        <span>婚姻狀況</span>
        <select name="marital" disabled={disabled} {...bind("marital")}>
          <option value="">—</option>
          {MARITAL.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
