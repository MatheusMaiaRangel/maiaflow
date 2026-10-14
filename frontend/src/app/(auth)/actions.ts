"use server";

import { redirect } from "next/navigation";
import { createApiClient } from "@/lib/api/client";
import {
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  problemFieldErrors,
  problemMessage,
} from "@/lib/api/problem";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSession } from "@/lib/auth/session";
import { loginSchema, signupSchema } from "@/lib/validation/auth";

/** Result of a form submission. On success the action redirects, so it never returns. */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";
const EMAIL_TAKEN = "Este e-mail já está cadastrado.";

async function signIn(
  email: string,
  password: string,
): Promise<AuthFormState & { token?: string }> {
  try {
    const { data, error, response } = await createApiClient().POST("/api/auth/login", {
      body: { email, password },
    });
    if (response.status === 401) return { error: INVALID_CREDENTIALS };
    if (error !== undefined || !data) return { error: problemMessage(error) };
    return { token: data.token };
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }
}

export async function loginAction(input: unknown, next?: string): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: GENERIC_ERROR_MESSAGE };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.token) return { error: result.error ?? GENERIC_ERROR_MESSAGE };

  await createSession(result.token);
  redirect(safeRedirectPath(next));
}

export async function signupAction(input: unknown): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { error: GENERIC_ERROR_MESSAGE };
  const { name, email, password } = parsed.data;

  try {
    const { error, response } = await createApiClient().POST("/api/users", {
      body: { name, email, password },
    });
    if (response.status === 409) return { fieldErrors: { email: EMAIL_TAKEN } };
    if (error !== undefined) {
      const fieldErrors = problemFieldErrors(error);
      return Object.keys(fieldErrors).length > 0
        ? { fieldErrors }
        : { error: problemMessage(error) };
    }
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }

  // The account exists now; sign in right away so the user lands inside the app.
  const result = await signIn(email, password);
  if (!result.token) redirect("/login");

  await createSession(result.token);
  redirect("/");
}
