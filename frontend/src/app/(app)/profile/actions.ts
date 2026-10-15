"use server";

import { redirect } from "next/navigation";
import { getAuthedApi } from "@/lib/api/client";
import { NETWORK_ERROR_MESSAGE, problemMessage } from "@/lib/api/problem";
import { destroySession } from "@/lib/auth/session";

/** Only returned when something went wrong; on success the user is sent to the login page. */
export type DeleteAccountState = { error: string };

/** Statuses that mean the account is already gone, which is what the user asked for. */
const ALREADY_GONE = new Set([401, 404]);

/**
 * Deletes the account (and its tasks and habits) and ends the session. This is a Server Action, not a
 * BFF call, because the session cookie has to be cleared in the same step.
 */
export async function deleteAccountAction(): Promise<DeleteAccountState> {
  const api = await getAuthedApi();

  try {
    const { error, response } = await api.DELETE("/api/users/me");
    if (!response.ok && !ALREADY_GONE.has(response.status)) {
      return { error: problemMessage(error) };
    }
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }

  await destroySession();
  redirect("/login?reason=deleted");
}
