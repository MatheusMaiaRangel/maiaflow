import { describe, expect, it } from "vitest";
import { hasWeekday, maskFromWeekdays, toggleWeekday, weekdaysFromMask } from "./weekdays";

describe("weekday bit mask", () => {
  it("builds the documented mask for Monday + Wednesday + Friday", () => {
    expect(maskFromWeekdays([1, 3, 5])).toBe(42);
  });

  it("uses Sunday = 1 and Saturday = 64", () => {
    expect(maskFromWeekdays([0])).toBe(1);
    expect(maskFromWeekdays([6])).toBe(64);
  });

  it("lists the days of a mask in ascending order", () => {
    expect(weekdaysFromMask(42)).toEqual([1, 3, 5]);
    expect(weekdaysFromMask(0)).toEqual([]);
    expect(weekdaysFromMask(127)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("ignores duplicated days when building a mask", () => {
    expect(maskFromWeekdays([2, 2, 4])).toBe(20);
  });

  it("switches a day on and off without touching the others", () => {
    const on = toggleWeekday(42, 0);
    expect(on).toBe(43);
    expect(toggleWeekday(on, 0)).toBe(42);
  });

  it("tells whether a day is on", () => {
    expect(hasWeekday(42, 1)).toBe(true);
    expect(hasWeekday(42, 2)).toBe(false);
  });

  it("rejects an index outside 0-6", () => {
    expect(() => toggleWeekday(0, 7)).toThrow(RangeError);
  });
});
