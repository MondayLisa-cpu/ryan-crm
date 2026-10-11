import { describe, expect, it } from "vitest";
import { PERFECT_TOTAL, kpiOf, pointsByActivity, sumCounts, totalPoints } from "@/lib/activity";
import { addDays, hkToday, isoWeek, mondayOf, quarterMondays, quarterOfWeek, weekDays } from "@/lib/weeks";

describe("WARS 計分", () => {
  it("完美標準總分 100", () => {
    expect(PERFECT_TOTAL).toBe(100);
    // 完美一週：R5次 N2次 A15次 RR10次 NR5次 PC3次
    expect(pointsByActivity({ r: 5, n: 2, a: 15, rr: 10, nr: 5, pc: 3 })).toEqual({ r: 5, n: 10, a: 30, rr: 20, nr: 20, pc: 15 });
    expect(totalPoints({ r: 5, n: 2, a: 15, rr: 10, nr: 5, pc: 3 })).toBe(100);
  });
  it("每次分數：R1 N5 A2 RR2 NR4 PC5", () => {
    expect(totalPoints({ r: 1 })).toBe(1);
    expect(totalPoints({ n: 1 })).toBe(5);
    expect(totalPoints({ a: 1 })).toBe(2);
    expect(totalPoints({ rr: 1 })).toBe(2);
    expect(totalPoints({ nr: 1 })).toBe(4);
    expect(totalPoints({ pc: 1 })).toBe(5);
  });
  it("KPI 顏色界線", () => {
    expect([0, 39, 40, 69, 70, 100, 130].map(kpiOf)).toEqual(["red", "red", "yellow", "yellow", "green", "green", "green"]);
  });
  it("加總多日", () => {
    expect(sumCounts([{ r: 1, a: 2 }, { r: 1, pc: 1 }])).toEqual({ r: 2, n: 0, a: 2, rr: 0, nr: 0, pc: 1 });
  });
});

describe("日期", () => {
  it("星期一開始", () => {
    expect(mondayOf("2026-10-10")).toBe("2026-10-05"); // 星期六
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // 星期日
    expect(weekDays("2026-10-05")).toHaveLength(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("香港時間：UTC 16:30 已經係翌日", () => {
    expect(hkToday(Date.UTC(2026, 9, 9, 16, 30))).toBe("2026-10-10");
    expect(hkToday(Date.UTC(2026, 9, 9, 15, 30))).toBe("2026-10-09");
  });
  it("ISO 週同季度", () => {
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    expect(isoWeek("2026-10-10")).toEqual({ year: 2026, week: 41 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
    expect(quarterOfWeek(13)).toBe(1);
    expect(quarterOfWeek(14)).toBe(2);
    expect(quarterOfWeek(53)).toBe(4);
    const q1 = quarterMondays(2026, 1);
    expect(q1).toHaveLength(13);
    expect(q1[0]).toBe("2025-12-29");
    expect(quarterMondays(2026, 4)).toHaveLength(14); // 2026 有第 53 週
    expect(quarterMondays(2027, 4)).toHaveLength(13);
  });
});
