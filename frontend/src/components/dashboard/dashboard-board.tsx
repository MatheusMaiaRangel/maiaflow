"use client";

import {
  CheckIcon,
  LayoutGridIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useId, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionError } from "@/components/today/section-states";
import { DashboardView } from "@/components/widgets/dashboard-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateOnly } from "@/lib/dates";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import {
  dashboardErrors,
  MAX_SECTION_TITLE_LENGTH,
  MAX_SECTIONS,
  MAX_WIDGETS,
  type DashboardConfig,
  type DashboardSection,
  type WidgetConfig,
} from "@/lib/widgets/config";
import { useDashboardSources } from "@/lib/widgets/data";
import {
  addSection,
  deleteSection,
  deleteWidget,
  newId,
  newWidget,
  renameSection,
  replaceSection,
  saveWidget,
  widgetIds,
} from "@/lib/widgets/edit";
import {
  useDashboard,
  useResetDashboard,
  useSaveDashboard,
  type Dashboard,
} from "@/lib/widgets/storage";
import { SectionGrid } from "./section-grid";
import { SectionList } from "./section-list";
import { WidgetEditor, type WidgetDraft } from "./widget-editor";

/** Same breakpoint as the read-only grid's four columns (`lg`). */
const WIDE_SCREEN = "(min-width: 64rem)";
const FIRST_SECTION_TITLE = "Gráficos";

type Editing = { draft: WidgetDraft; isNew: boolean } | null;
type SectionDialog = { mode: "add" } | { mode: "rename"; section: DashboardSection } | null;
type Confirm = { kind: "widget"; widget: WidgetConfig } | { kind: "reset" } | null;

function SectionNameDialog({
  dialog,
  onSubmit,
  onClose,
}: {
  dialog: NonNullable<SectionDialog>;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const errorId = useId();
  const [title, setTitle] = useState(dialog.mode === "rename" ? dialog.section.title : "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_SECTION_TITLE_LENGTH) {
      setError(`O nome precisa ter de 1 a ${MAX_SECTION_TITLE_LENGTH} caracteres.`);
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialog.mode === "add" ? "Nova seção" : "Renomear seção"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={id}>Nome da seção</Label>
            <Input
              id={id}
              value={title}
              maxLength={MAX_SECTION_TITLE_LENGTH}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
              className="h-11 sm:h-9"
            />
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="h-11 sm:h-8">
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type BoardProps = {
  today: DateOnly;
  tasksSeed?: ServerSeed<Task[]>;
  dashboardSeed?: ServerSeed<Dashboard>;
};

/**
 * The user's dashboard below the fixed Today cards (D26, D28): read-only until "Editar painel", then
 * widgets can be added, edited, moved, resized and deleted, and sections added, renamed and removed.
 * Every change is checked with `dashboardErrors()` and saved at once.
 */
export function DashboardBoard({ today, tasksSeed, dashboardSeed }: BoardProps) {
  const dashboard = useDashboard(dashboardSeed);
  const save = useSaveDashboard();
  const reset = useResetDashboard();
  const wide = useMediaQuery(WIDE_SCREEN);
  const [isEditing, setIsEditing] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [sectionDialog, setSectionDialog] = useState<SectionDialog>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [announcement, setAnnouncement] = useState("");
  // The same text twice in a row would not change the live region, so screen readers would stay silent.
  const announce = useCallback(
    (message: string) =>
      setAnnouncement((previous) => (previous === message ? `${message}\u00a0` : message)),
    [],
  );

  const config = dashboard.data?.config;
  const widgets = useMemo(
    () => config?.sections.flatMap((section) => section.widgets) ?? [],
    [config],
  );
  const sources = useDashboardSources(widgets, today, tasksSeed);

  if (!config) {
    return dashboard.isError ? (
      <SectionError what="o seu painel" onRetry={() => void dashboard.refetch()} />
    ) : (
      <Skeleton role="status" aria-label="Carregando o painel" className="h-64 w-full" />
    );
  }
  const current: DashboardConfig = config;

  function commit(next: DashboardConfig): boolean {
    if (next === current) return true;
    const errors = dashboardErrors(next);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return false;
    }
    save.mutate(next);
    return true;
  }

  function changeSection(section: DashboardSection): boolean {
    return commit(replaceSection(current, section));
  }

  function startNewWidget() {
    if (widgets.length >= MAX_WIDGETS) {
      toast.error(`O painel já tem ${MAX_WIDGETS} gráficos, o máximo.`);
      return;
    }
    const sectionId = current.sections[0]?.id ?? "graficos";
    setEditing({
      draft: { sectionId, widget: newWidget(newId("w", widgetIds(current))) },
      isNew: true,
    });
  }

  function saveDraft({ sectionId, widget }: WidgetDraft) {
    const withSection = current.sections.some(({ id }) => id === sectionId)
      ? current
      : addSection(current, FIRST_SECTION_TITLE, sectionId);
    if (commit(saveWidget(withSection, sectionId, widget))) {
      setEditing(null);
      announce(`${widget.title} salvo.`);
    }
  }

  function saveSectionName(title: string) {
    if (!sectionDialog) return;
    const ids = new Set(current.sections.map(({ id }) => id));
    const next =
      sectionDialog.mode === "add"
        ? addSection(current, title, newId("s", ids))
        : renameSection(current, sectionDialog.section.id, title);
    if (commit(next)) setSectionDialog(null);
  }

  function confirmAction() {
    if (confirm?.kind === "widget") {
      if (commit(deleteWidget(current, confirm.widget.id)))
        announce(`${confirm.widget.title} excluído.`);
      setEditing(null);
    } else if (confirm?.kind === "reset") {
      reset.mutate();
      announce("Painel padrão restaurado.");
    }
    setConfirm(null);
  }

  const sectionsForEditor =
    current.sections.length > 0
      ? current.sections
      : [{ id: "graficos", title: FIRST_SECTION_TITLE, widgets: [] }];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isEditing ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={startNewWidget}>
              <PlusIcon aria-hidden />
              Adicionar gráfico
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                current.sections.length >= MAX_SECTIONS
                  ? toast.error(`O painel já tem ${MAX_SECTIONS} seções, o máximo.`)
                  : setSectionDialog({ mode: "add" })
              }
            >
              <LayoutGridIcon aria-hidden />
              Adicionar seção
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirm({ kind: "reset" })}
            >
              <RotateCcwIcon aria-hidden />
              Restaurar padrão
            </Button>
            <Button type="button" size="sm" onClick={() => setIsEditing(false)}>
              <CheckIcon aria-hidden />
              Concluir
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <PencilIcon aria-hidden />
            Editar painel
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="grid min-w-0 gap-6">
          {current.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              O painel está vazio. Use “Adicionar gráfico” para começar.
            </p>
          ) : null}
          {current.sections.map((section) => (
            <EditableSection
              key={section.id}
              section={section}
              wide={wide}
              onRename={() => setSectionDialog({ mode: "rename", section })}
              onDelete={() => commit(deleteSection(current, section.id))}
              onChange={changeSection}
              onEdit={(widget) =>
                setEditing({ draft: { sectionId: section.id, widget }, isNew: false })
              }
              onDeleteWidget={(widget) => setConfirm({ kind: "widget", widget })}
              announce={announce}
              sources={sources}
              today={today}
            />
          ))}
        </div>
      ) : (
        <DashboardView config={current} today={today} tasksSeed={tasksSeed} />
      )}

      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>

      {editing ? (
        <WidgetEditor
          initial={editing.draft}
          isNew={editing.isNew}
          sections={sectionsForEditor}
          today={today}
          tasksSeed={tasksSeed}
          onSave={saveDraft}
          onDelete={() => setConfirm({ kind: "widget", widget: editing.draft.widget })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {sectionDialog ? (
        <SectionNameDialog
          dialog={sectionDialog}
          onSubmit={saveSectionName}
          onClose={() => setSectionDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title={confirm?.kind === "reset" ? "Restaurar o painel padrão?" : "Excluir gráfico?"}
        description={
          confirm?.kind === "reset"
            ? "Os seus gráficos e seções serão trocados pelo conjunto padrão, em todos os aparelhos."
            : `“${confirm?.kind === "widget" ? confirm.widget.title : ""}” sai do painel em todos os aparelhos.`
        }
        confirmLabel={confirm?.kind === "reset" ? "Restaurar" : "Excluir"}
        onConfirm={confirmAction}
      />
    </div>
  );
}

type EditableSectionProps = {
  section: DashboardSection;
  wide: boolean;
  onRename: () => void;
  onDelete: () => void;
  onChange: (section: DashboardSection) => boolean;
  onEdit: (widget: WidgetConfig) => void;
  onDeleteWidget: (widget: WidgetConfig) => void;
  announce: (message: string) => void;
  sources: ReturnType<typeof useDashboardSources>;
  today: DateOnly;
};

function EditableSection({
  section,
  wide,
  onRename,
  onDelete,
  onChange,
  onEdit,
  onDeleteWidget,
  announce,
  sources,
  today,
}: EditableSectionProps) {
  const headingId = useId();
  const isEmpty = section.widgets.length === 0;

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-3">
      <div className="flex items-center gap-1">
        <h3 id={headingId} className="text-base font-semibold tracking-tight">
          {section.title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Renomear a seção ${section.title}`}
          onClick={onRename}
        >
          <PencilIcon aria-hidden />
        </Button>
        {isEmpty ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir a seção ${section.title}`}
            onClick={onDelete}
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : null}
      </div>
      {isEmpty ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Seção vazia. Ao criar ou editar um gráfico, escolha esta seção.
        </p>
      ) : wide ? (
        <SectionGrid
          section={section}
          sources={sources}
          today={today}
          onChange={onChange}
          onEdit={onEdit}
          onDelete={onDeleteWidget}
          announce={announce}
        />
      ) : (
        <SectionList
          section={section}
          onChange={onChange}
          onEdit={onEdit}
          onDelete={onDeleteWidget}
          announce={announce}
        />
      )}
    </section>
  );
}
