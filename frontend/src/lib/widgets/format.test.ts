import { describe, expect, it } from "vitest";
import type { MetricResult } from "@/lib/metrics/types";
import { describeSeries, formatPeriod, formatValue, hasValues } from "./format";

const result = (series: MetricResult["series"]): MetricResult => ({
  range: { from: "2026-10-15", to: "2026-10-17" },
  buckets: [
    { key: "a", label: "Seg" },
    { key: "b", label: "Ter" },
  ],
  series,
});

describe("formatValue", () => {
  it("formats counts, percentages and streaks", () => {
    expect(formatValue(12, "count")).toBe("12");
    expect(formatValue(66.666, "percent")).toBe("67%");
    expect(formatValue(1, "streak")).toBe("1 seguida");
    expect(formatValue(0, "streak")).toBe("0 seguidas");
    expect(formatValue(null, "percent")).toBe("—");
  });
});

describe("formatPeriod", () => {
  it("names the period", () => {
    expect(formatPeriod({ kind: "last", days: 30 })).toBe("Últimos 30 dias");
    expect(formatPeriod({ kind: "next", days: 7 })).toBe("Próximos 7 dias");
    expect(formatPeriod({ kind: "custom", from: "2026-10-01", to: "2026-10-15" })).toBe(
      "01/10/2026 a 15/10/2026",
    );
  });
});

describe("hasValues", () => {
  it("is false when everything is zero or empty", () => {
    expect(hasValues(result([{ unit: "count", values: [0, 0] }]))).toBe(false);
    expect(hasValues(result([{ unit: "percent", values: [null, null] }]))).toBe(false);
    expect(hasValues(result([{ unit: "percent", values: [null, 50] }]))).toBe(true);
  });
});

describe("describeSeries", () => {
  it("sums counts and names the best bucket of the rest", () => {
    expect(
      describeSeries(
        result([
          { unit: "count", values: [2, 3] },
          { unit: "percent", values: [40, 75] },
          { unit: "percent", values: [null, null] },
        ]),
        ["Feitos", "Conclusão", "Vazia"],
      ),
    ).toBe("Feitos: 5 no total. Conclusão: maior valor 75% (Ter). Vazia: sem dados.");
  });

  it("keeps the first bucket on ties", () => {
    expect(describeSeries(result([{ unit: "streak", values: [3, 3] }]), ["Seq"])).toBe(
      "Seq: maior valor 3 seguidas (Seg).",
    );
  });
});
