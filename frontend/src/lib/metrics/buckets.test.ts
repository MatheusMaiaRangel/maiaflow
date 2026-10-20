import { describe, expect, it } from "vitest";
import { dayMonth, habitBuckets, timeBuckets, timeKey, weekStart } from "./buckets";

describe("timeKey", () => {
  it("places a day in its bucket", () => {
    expect(timeKey("none", "2026-10-17")).toBe("total");
    expect(timeKey("day", "2026-10-17")).toBe("2026-10-17");
    expect(timeKey("week", "2026-10-17")).toBe("2026-10-11");
    expect(timeKey("weekday", "2026-10-17")).toBe("6");
  });

  it("starts weeks on Sunday", () => {
    expect(weekStart("2026-10-11")).toBe("2026-10-11");
    expect(weekStart("2026-10-12")).toBe("2026-10-11");
    expect(dayMonth("2026-01-05")).toBe("05/01");
  });
});

describe("timeBuckets", () => {
  const range = { from: "2026-10-08", to: "2026-10-19" };

  it("has one total bucket", () => {
    expect(timeBuckets("none", range)).toEqual([{ key: "total", label: "Total", range }]);
  });

  it("has one bucket per day", () => {
    const days = timeBuckets("day", { from: "2026-10-16", to: "2026-10-17" });
    expect(days).toEqual([
      { key: "2026-10-16", label: "16/10", range: { from: "2026-10-16", to: "2026-10-16" } },
      { key: "2026-10-17", label: "17/10", range: { from: "2026-10-17", to: "2026-10-17" } },
    ]);
  });

  it("clips the first and last week to the range", () => {
    expect(timeBuckets("week", range)).toEqual([
      { key: "2026-10-04", label: "08/10", range: { from: "2026-10-08", to: "2026-10-10" } },
      { key: "2026-10-11", label: "11/10", range: { from: "2026-10-11", to: "2026-10-17" } },
      { key: "2026-10-18", label: "18/10", range: { from: "2026-10-18", to: "2026-10-19" } },
    ]);
  });

  it("always has the seven weekdays, Sunday first", () => {
    expect(timeBuckets("weekday", range).map((bucket) => bucket.label)).toEqual([
      "Dom",
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
    ]);
  });
});

describe("habitBuckets", () => {
  it("orders habits by id", () => {
    expect(
      habitBuckets(
        new Map([
          [3, "Ler"],
          [1, "Correr"],
        ]),
      ),
    ).toEqual([
      { key: "habit:1", label: "Correr" },
      { key: "habit:3", label: "Ler" },
    ]);
  });
});
