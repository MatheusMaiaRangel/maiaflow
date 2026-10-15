import { describe, expect, it } from "vitest";
import { ClientApiError } from "@/lib/api/browser";
import { describeSubmitError } from "./form-errors";

describe("describeSubmitError", () => {
  it("places model-binding errors under their inputs and shows no alert", () => {
    const error = new ClientApiError(400, {
      errors: { Title: ["Título inválido."], IntervalDays: ["Intervalo inválido."] },
    });

    expect(describeSubmitError(error, ["title", "recurrence.intervalDays"])).toEqual({
      fieldErrors: [
        ["title", "Título inválido."],
        ["recurrence.intervalDays", "Intervalo inválido."],
      ],
    });
  });

  it("falls back to an alert when the field is not part of the form", () => {
    const error = new ClientApiError(400, { errors: { StartDate: ["Data inválida."] } });

    const view = describeSubmitError(error, ["title"]);

    expect(view.fieldErrors).toEqual([]);
    expect(view.alert).toBe("Data inválida.");
  });

  it("shows the API's Portuguese detail as an alert", () => {
    const error = new ClientApiError(400, { detail: "A data de início está fora do limite." });

    expect(describeSubmitError(error, ["title"]).alert).toBe(
      "A data de início está fora do limite.",
    );
  });

  it("shows a connection message for network failures", () => {
    expect(describeSubmitError(new TypeError("fetch failed"), ["title"]).alert).toBe(
      "Não foi possível conectar ao servidor. Tente novamente.",
    );
  });

  it("shows a generic message for unknown errors", () => {
    expect(describeSubmitError(new Error("boom"), ["title"]).alert).toBe(
      "Algo deu errado. Tente novamente.",
    );
  });
});
