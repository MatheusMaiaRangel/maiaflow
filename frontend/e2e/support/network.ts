import { expect, type Page, type Response } from "@playwright/test";

/**
 * Runs `action` and waits until the browser got a successful answer from the app's API proxy for a
 * request matching `method` and `path` (a RegExp over the URL path). Use it before a reload when the UI
 * updates optimistically, so the reload never cancels the request that saves the change.
 */
export async function expectApiCall(
  page: Page,
  method: string,
  path: RegExp,
  action: () => Promise<void>,
): Promise<Response> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === method && path.test(new URL(response.url()).pathname),
  );
  await action();
  const response = await answered;
  expect(response.ok(), `${method} ${response.url()} answered ${response.status()}`).toBe(true);
  return response;
}
