import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  byHabit,
  countsOccurrence,
  currentStreak,
  entersRate,
  habitTitles,
  matchesFilter,
  streakRange,
} from "./habits";
import { occurrence, TODAY } from "./test-data";

const yesterday = addDays(TODAY, -1);

describe("countsOccurrence", () => {
  it("counts by status, and every occurrence as scheduled", () => {
    const completed = occurrence(1, TODAY, "Completed");
    const missed = occurrence(1, TODAY, "NotCompleted");
    const open = occurrence(1, TODAY, "Pending");

    expect([completed, missed, open].map((o) => countsOccurrence("habits.scheduled", o))).toEqual([
      true,
      true,
      true,
    ]);
    expect(countsOccurrence("habits.completed", completed)).toBe(true);
    expect(countsOccurrence("habits.completed", missed)).toBe(false);
    expect(countsOccurrence("habits.notCompleted", missed)).toBe(true);
    expect(countsOccurrence("habits.pending", open)).toBe(true);
    expect(countsOccurrence("habits.pending", completed)).toBe(false);
  });
});

describe("entersRate", () => {
  it("leaves out pending occurrences from today on, but not past ones", () => {
    expect(entersRate(occurrence(1, TODAY, "Pending"), TODAY)).toBe(false);
    expect(entersRate(occurrence(1, addDays(TODAY, 1), "Pending"), TODAY)).toBe(false);
    expect(entersRate(occurrence(1, yesterday, "Pending"), TODAY)).toBe(true);
    expect(entersRate(occurrence(1, TODAY, "NotCompleted"), TODAY)).toBe(true);
  });
});

describe("currentStreak", () => {
  it("counts completed occurrences in a row up to today", () => {
    const list = [
      occurrence(1, addDays(TODAY, -3), "NotCompleted"),
      occurrence(1, addDays(TODAY, -2)),
      occurrence(1, yesterday),
      occurrence(1, TODAY),
    ];
    expect(currentStreak(list, TODAY)).toBe(3);
  });

  it("is not broken by today's pending occurrence, but is by a past pending one", () => {
    expect(currentStreak([occurrence(1, yesterday), occurrence(1, TODAY, "Pending")], TODAY)).toBe(
      1,
    );
    expect(
      currentStreak(
        [occurrence(1, addDays(TODAY, -2)), occurrence(1, yesterday, "Pending")],
        TODAY,
      ),
    ).toBe(0);
  });

  it("ignores future occurrences and anything older than the look-back", () => {
    const { from } = streakRange(TODAY);
    expect(from).toBe(addDays(TODAY, -364));
    const list = [
      occurrence(1, addDays(from, -1)),
      occurrence(1, from),
      occurrence(1, addDays(TODAY, 1), "Pending"),
    ];
    expect(currentStreak(list, TODAY)).toBe(1);
  });

  it("is zero with nothing to count", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });
});

describe("habit helpers", () => {
  it("filters by habit", () => {
    expect(matchesFilter(occurrence(2, TODAY), { kind: "all" })).toBe(true);
    expect(matchesFilter(occurrence(2, TODAY), { kind: "habit", habitId: 2 })).toBe(true);
    expect(matchesFilter(occurrence(2, TODAY), { kind: "habit", habitId: 3 })).toBe(false);
  });

  it("groups occurrences by habit", () => {
    const groups = byHabit([occurrence(1, TODAY), occurrence(2, TODAY), occurrence(1, yesterday)]);
    expect(groups.get(1)).toHaveLength(2);
    expect(groups.get(2)).toHaveLength(1);
  });

  it("uses the newest title of each habit", () => {
    const titles = habitTitles([
      occurrence(1, TODAY, "Completed", "Ler 20 páginas"),
      occurrence(1, yesterday, "Completed", "Ler"),
      occurrence(2, yesterday, "Completed", "Correr"),
    ]);
    expect(titles).toEqual(
      new Map([
        [1, "Ler 20 páginas"],
        [2, "Correr"],
      ]),
    );
  });
});
