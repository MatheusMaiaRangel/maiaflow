import { describe, expect, it } from "vitest";
import { GENERIC_ERROR_MESSAGE, problemFieldErrors, problemMessage } from "./problem";

describe("problemMessage", () => {
  it("uses the API's detail", () => {
    expect(problemMessage({ status: 409, detail: "E-mail já cadastrado." })).toBe(
      "E-mail já cadastrado.",
    );
  });

  it("falls back to the first binding error", () => {
    expect(problemMessage({ errors: { Title: ["O título é obrigatório."] } })).toBe(
      "O título é obrigatório.",
    );
  });

  it.each([undefined, null, "oops", 42, {}, { detail: "  " }])(
    "returns the generic message for %j",
    (value) => {
      expect(problemMessage(value)).toBe(GENERIC_ERROR_MESSAGE);
    },
  );

  it("accepts a custom fallback", () => {
    expect(problemMessage({}, "x")).toBe("x");
  });
});

describe("problemFieldErrors", () => {
  it("maps binding errors to camelCase field names", () => {
    expect(
      problemFieldErrors({
        errors: { Email: ["Inválido."], "createUserDto.Name": ["Curto."], $: ["Corpo inválido."] },
      }),
    ).toEqual({ email: "Inválido.", name: "Curto." });
  });

  it("returns an empty object when there is nothing to map", () => {
    expect(problemFieldErrors(undefined)).toEqual({});
    expect(problemFieldErrors({ detail: "x" })).toEqual({});
  });
});
