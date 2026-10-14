import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InboxIcon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.fn();
const logoutAction = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@/app/(app)/actions", () => ({ logoutAction: () => logoutAction() }));

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppShell } from "./app-shell";
import { NavLinks } from "./nav-links";

beforeEach(() => {
  pathname.mockReset().mockReturnValue("/tasks");
  logoutAction.mockReset();
});

describe("NavLinks", () => {
  it("lists every section in Portuguese and marks the current one", () => {
    render(<NavLinks />);

    for (const label of ["Hoje", "Tarefas", "Hábitos", "Calendário", "Perfil"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Tarefas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hoje" })).not.toHaveAttribute("aria-current");
  });

  it("calls onNavigate when a link is used", async () => {
    const onNavigate = vi.fn();
    render(<NavLinks onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole("link", { name: "Hábitos" }));

    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("AppShell", () => {
  it("shows the navigation, the page content and the user's account menu", () => {
    render(
      <AppShell user={{ name: "Maria Silva", email: "maria@example.com" }}>
        <p>Conteúdo</p>
      </AppShell>,
    );

    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(
      screen.getAllByRole("navigation", { name: "Navegação principal" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Conta de Maria Silva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alterar tema" })).toBeInTheDocument();
  });

  it("signs the user out from the account menu", async () => {
    render(
      <AppShell user={{ name: "Maria Silva", email: "maria@example.com" }}>
        <p>x</p>
      </AppShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Conta de Maria Silva" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Sair/ }));

    expect(logoutAction).toHaveBeenCalled();
  });
});

describe("ThemeToggle", () => {
  it("offers light, dark and system themes", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Alterar tema" }));

    for (const label of ["Claro", "Escuro", "Sistema"]) {
      expect(await screen.findByRole("menuitem", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });
});

describe("PageHeader and EmptyState", () => {
  it("render their text", () => {
    render(
      <>
        <PageHeader title="Tarefas" description="Tudo o que você precisa fazer." />
        <EmptyState icon={InboxIcon} title="Nenhuma tarefa ainda" description="Crie a primeira." />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Tarefas" })).toBeInTheDocument();
    expect(screen.getByText("Tudo o que você precisa fazer.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma tarefa ainda")).toBeInTheDocument();
  });
});
