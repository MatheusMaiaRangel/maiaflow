import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reason } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next) : undefined;
  const notice = reason === "expired" ? "Sua sessão expirou. Entre novamente." : undefined;

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
