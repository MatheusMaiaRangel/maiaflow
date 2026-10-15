import { describe, expect, it } from "vitest";
import { taskFormSchema, toTaskBody } from "./task";

const valid = { title: "Pagar conta de luz", description: "", dueDate: "" };

function firstMessage(input: unknown): string | undefined {
  const result = taskFormSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("taskFormSchema", () => {
  it("accepts a title alone", () => {
    expect(taskFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a blank title", () => {
    expect(firstMessage({ ...valid, title: "   " })).toBe("Informe o título da tarefa.");
  });

  it("rejects a title longer than 150 characters", () => {
    expect(firstMessage({ ...valid, title: "a".repeat(151) })).toBe(
      "O título deve ter no máximo 150 caracteres.",
    );
    expect(taskFormSchema.safeParse({ ...valid, title: "a".repeat(150) }).success).toBe(true);
  });

  it("rejects a description longer than 500 characters", () => {
    expect(firstMessage({ ...valid, description: "a".repeat(501) })).toBe(
      "A descrição deve ter no máximo 500 caracteres.",
    );
  });

  it("accepts a calendar day as due date and rejects anything else", () => {
    expect(taskFormSchema.safeParse({ ...valid, dueDate: "2026-10-14" }).success).toBe(true);
    expect(firstMessage({ ...valid, dueDate: "2026-02-31" })).toBe("Informe uma data válida.");
    expect(firstMessage({ ...valid, dueDate: "14/10/2026" })).toBe("Informe uma data válida.");
  });
});

describe("toTaskBody", () => {
  it("sends null for a blank description and due date so PATCH clears them", () => {
    expect(toTaskBody({ title: " Estudar ", description: "  ", dueDate: "" })).toEqual({
      title: "Estudar",
      description: null,
      dueDate: null,
    });
  });

  it("converts the due date to an API date-time without zone", () => {
    expect(
      toTaskBody({ title: "Estudar", description: " Cap. 3 ", dueDate: "2026-10-14" }),
    ).toEqual({
      title: "Estudar",
      description: "Cap. 3",
      dueDate: "2026-10-14T00:00:00",
    });
  });
});
