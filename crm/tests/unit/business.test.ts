import { describe, expect, it } from "vitest";
import { addMonths, isMonth, monthLabel, parseAmount, pct, totals } from "@/lib/business";

describe("每月生意表", () => {
  it("讀金額：逗號、$、萬", () => {
    expect(parseAmount("12,000")).toBe(12000);
    expect(parseAmount("$3,500.50")).toBe(3500.5);
    expect(parseAmount("1.2萬")).toBe(12000);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
  it("合計同 case 數", () => {
    expect(
      totals([
        { afyp: 12000, revenue: 9000, commission: 3600.5 },
        { afyp: 8000, revenue: 6000, commission: 2400.25 },
      ]),
    ).toEqual({ cases: 2, afyp: 20000, revenue: 15000, commission: 6000.75 });
  });
  it("完成度", () => {
    expect(pct(15000, 20000)).toBe(75);
    expect(pct(25000, 20000)).toBe(125);
    expect(pct(100, 0)).toBeNull();
  });
  it("月份", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-03")).toBe("2026 年 3 月");
  });
});
