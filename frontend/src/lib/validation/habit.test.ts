import { describe, expect, it } from "vitest";
import { DEFAULT_RECURRENCE } from "@/lib/habits/recurrence";
import {
  changeRecurrenceSchema,
  createHabitSchema,
  editHabitSchema,
  recurrenceSchema,
} from "./habit";

const TODAY = "2026-10-14";

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("recurrenceSchema", () => {
  it("accepts a daily rule with nothing else", () => {
    expect(recurrenceSchema.safeParse(DEFAULT_RECURRENCE).success).toBe(true);
  });

  it.each(["", "0", "-2", "1.5", "abc", "3651"])("rejects the interval %j", (intervalDays) => {
    const result = recurrenceSchema.safeParse({
      ...DEFAULT_RECURRENCE,
      frequencyType: "IntervalDays",
      intervalDays,
    });
    expect(messages(result)).toEqual(["Informe um número inteiro de 1 a 3650 dias."]);
  });

  it.each(["1", "3650", " 7 "])("accepts the interval %j", (intervalDays) => {
    expect(
      recurrenceSchema.safeParse({
        ...DEFAULT_RECURRENCE,
        frequencyType: "IntervalDays",
        intervalDays,
      }).success,
    ).toBe(true);
  });

  it("requires at least one weekday for specific days", () => {
    const empty = recurrenceSchema.safeParse({
      ...DEFAULT_RECURRENCE,
      frequencyType: "SpecificDaysOfWeek",
    });
    expect(messages(empty)).toEqual(["Escolha pelo menos um dia da semana."]);
    expect(
      recurrenceSchema.safeParse({
        ...DEFAULT_RECURRENCE,
        frequencyType: "SpecificDaysOfWeek",
        daysOfWeek: 42,
      }).success,
    ).toBe(true);
  });

  it("requires a day of the month or the last-day flag for monthly", () => {
    const empty = recurrenceSchema.safeParse({ ...DEFAULT_RECURRENCE, frequencyType: "Monthly" });
    expect(messages(empty)).toEqual([
      "Escolha pelo menos um dia do mês ou marque “Último dia do mês”.",
    ]);
    expect(
      recurrenceSchema.safeParse({
        ...DEFAULT_RECURRENCE,
        frequencyType: "Monthly",
        daysOfMonth: [31],
      }).success,
    ).toBe(true);
    expect(
      recurrenceSchema.safeParse({
        ...DEFAULT_RECURRENCE,
        frequencyType: "Monthly",
        lastDayOfMonth: true,
      }).success,
    ).toBe(true);
  });

  it("ignores the fields of other types", () => {
    expect(
      recurrenceSchema.safeParse({
        ...DEFAULT_RECURRENCE,
        frequencyType: "Weekly",
        intervalDays: "x",
      }).success,
    ).toBe(true);
  });

  it("puts the error on the field that needs fixing", () => {
    const result = recurrenceSchema.safeParse({
      ...DEFAULT_RECURRENCE,
      frequencyType: "IntervalDays",
    });
    expect(result.error?.issues[0].path).toEqual(["intervalDays"]);
  });
});

describe("createHabitSchema", () => {
  const schema = createHabitSchema(TODAY);
  const valid = {
    title: "Beber água",
    description: "",
    startDate: TODAY,
    recurrence: DEFAULT_RECURRENCE,
  };

  it("accepts a valid habit and trims text", () => {
    const result = schema.safeParse({
      ...valid,
      title: "  Beber água  ",
      description: " 2 litros ",
    });
    expect(result.data).toMatchObject({ title: "Beber água", description: "2 litros" });
  });

  it("rejects a short title", () => {
    expect(messages(schema.safeParse({ ...valid, title: " ab " }))).toEqual([
      "O título deve ter pelo menos 3 caracteres.",
    ]);
  });

  it("rejects a long title and a long description", () => {
    expect(messages(schema.safeParse({ ...valid, title: "a".repeat(151) }))).toEqual([
      "O título deve ter no máximo 150 caracteres.",
    ]);
    expect(messages(schema.safeParse({ ...valid, description: "a".repeat(501) }))).toEqual([
      "A descrição deve ter no máximo 500 caracteres.",
    ]);
  });

  it("requires a valid start date", () => {
    expect(messages(schema.safeParse({ ...valid, startDate: "" }))).toEqual([
      "Informe a data de início.",
    ]);
    expect(messages(schema.safeParse({ ...valid, startDate: "2026-02-31" }))).toEqual([
      "Informe uma data válida.",
    ]);
  });

  it("limits the start date to 2 years back and 5 years ahead", () => {
    const rangeMessage = "A data de início deve estar entre 2 anos atrás e 5 anos à frente.";
    expect(schema.safeParse({ ...valid, startDate: "2024-10-14" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, startDate: "2031-10-14" }).success).toBe(true);
    expect(messages(schema.safeParse({ ...valid, startDate: "2024-10-13" }))).toEqual([
      rangeMessage,
    ]);
    expect(messages(schema.safeParse({ ...valid, startDate: "2031-10-15" }))).toEqual([
      rangeMessage,
    ]);
  });

  it("validates the nested recurrence", () => {
    const result = schema.safeParse({
      ...valid,
      recurrence: { ...DEFAULT_RECURRENCE, frequencyType: "IntervalDays" },
    });
    expect(result.error?.issues[0].path).toEqual(["recurrence", "intervalDays"]);
  });
});

describe("editHabitSchema", () => {
  it("validates title and description", () => {
    expect(editHabitSchema.safeParse({ title: "Ler", description: "" }).success).toBe(true);
    expect(editHabitSchema.safeParse({ title: "Le", description: "" }).success).toBe(false);
  });
});

describe("changeRecurrenceSchema", () => {
  const schema = changeRecurrenceSchema(TODAY);

  it("accepts an empty apply-from date", () => {
    expect(schema.safeParse({ recurrence: DEFAULT_RECURRENCE, effectiveFrom: "" }).success).toBe(
      true,
    );
  });

  it("accepts tomorrow and up to 5 years ahead", () => {
    expect(
      schema.safeParse({ recurrence: DEFAULT_RECURRENCE, effectiveFrom: "2026-10-15" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ recurrence: DEFAULT_RECURRENCE, effectiveFrom: "2031-10-14" }).success,
    ).toBe(true);
  });

  it("rejects today, earlier days and days beyond 5 years", () => {
    for (const effectiveFrom of ["2026-10-13", "2026-10-14", "2031-10-15"]) {
      expect(messages(schema.safeParse({ recurrence: DEFAULT_RECURRENCE, effectiveFrom }))).toEqual(
        ["A data deve ser de amanhã até 5 anos à frente."],
      );
    }
  });

  it("rejects text that is not a date", () => {
    expect(
      schema.safeParse({ recurrence: DEFAULT_RECURRENCE, effectiveFrom: "amanhã" }).success,
    ).toBe(false);
  });

  it("validates the recurrence", () => {
    const result = schema.safeParse({
      recurrence: { ...DEFAULT_RECURRENCE, frequencyType: "Monthly" },
      effectiveFrom: "",
    });
    expect(result.success).toBe(false);
  });
});
