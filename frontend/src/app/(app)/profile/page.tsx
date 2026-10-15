import type { Metadata } from "next";
import { DeleteAccount } from "@/components/profile/delete-account";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Perfil" };

export default async function Page() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title="Perfil" description="Seus dados de acesso." />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>Nome e e-mail usados para entrar no MaiaFlow.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm initial={{ name: user.name, email: user.email }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Senha</CardTitle>
            <CardDescription>Use pelo menos 6 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Excluir conta</CardTitle>
            <CardDescription>
              Apaga sua conta com todas as tarefas e hábitos. Não dá para desfazer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccount />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
