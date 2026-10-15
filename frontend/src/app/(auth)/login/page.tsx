import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Entrar" };

const LOGIN_NOTICES = new Map([
  ["expired", "Sua sessão expirou. Entre novamente."],
  ["deleted", "Sua conta foi excluída."],
]);

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reason } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;
  const notice = typeof reason === "string" ? LOGIN_NOTICES.get(reason) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse suas tarefas e hábitos.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={nextPath} notice={notice} />
      </CardContent>
    </Card>
  );
}
