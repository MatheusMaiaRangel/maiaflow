import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClearQueryCache } from "./clear-query-cache";

describe("ClearQueryCache", () => {
  it("removes cached data of the previous user", () => {
    const client = new QueryClient();
    client.setQueryData(["tasks"], [{ id: 1, title: "Tarefa do usuário anterior" }]);
    client.setQueryData(["habits", "list"], [{ id: 1 }]);

    render(
      <QueryClientProvider client={client}>
        <ClearQueryCache />
      </QueryClientProvider>,
    );

    expect(client.getQueryData(["tasks"])).toBeUndefined();
    expect(client.getQueryData(["habits", "list"])).toBeUndefined();
  });
});
