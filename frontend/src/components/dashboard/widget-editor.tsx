"use client";

import { Trash2Icon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { WidgetCard } from "@/components/widgets/widget-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DateOnly } from "@/lib/dates";
import { useHabits } from "@/lib/habits/hooks";
import { GROUPING_LABELS, isHabitVariable } from "@/lib/metrics/catalog";
import { GROUPINGS, type Grouping } from "@/lib/metrics/types";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import {
  CHART_TYPES,
  GRID_COLUMNS,
  MAX_ROWS_PER_WIDGET,
  MAX_TITLE_LENGTH,
  widgetErrors,
  type ChartType,
  type DashboardSection,
  type WidgetConfig,
} from "@/lib/widgets/config";
import { useDashboardSources, widgetState } from "@/lib/widgets/data";
import { withChart, withoutField } from "@/lib/widgets/edit";
import { CHART_LABELS, PERIOD_OPTIONS, periodFromValue, periodValue } from "@/lib/widgets/labels";
import { ColorField } from "./color-field";
import { SelectField } from "./select-field";
import { SeriesFields } from "./series-fields";

const PREVIEW_CHART_HEIGHT = 200;
const ALL_HABITS = "all";
const STACKABLE: readonly ChartType[] = ["bar", "area"];

const GROUPING_OPTIONS = GROUPINGS.map((grouping) => ({
  value: grouping,
  label: GROUPING_LABELS[grouping],
}));
const SIZE_OPTIONS = (max: number, noun: [string, string]) =>
  Array.from({ length: max }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1} ${index === 0 ? noun[0] : noun[1]}`,
  }));
const WIDTH_OPTIONS = SIZE_OPTIONS(GRID_COLUMNS, ["coluna", "colunas"]);
const HEIGHT_OPTIONS = SIZE_OPTIONS(MAX_ROWS_PER_WIDGET, ["linha", "linhas"]);

/** A change to the draft, applied to its current state (never to an older copy). */
type WidgetChange = (widget: WidgetConfig) => WidgetConfig;

/** Moves one end of a custom period; other periods stay as they are. */
function withCustomDay(
  widget: WidgetConfig,
  day: { from: DateOnly } | { to: DateOnly },
): WidgetConfig {
  return widget.period.kind === "custom"
    ? { ...widget, period: { ...widget.period, ...day } }
    : widget;
}

function usesHabits(widget: WidgetConfig): boolean {
  return widget.series.some(
    ({ metric }) =>
      isHabitVariable(metric.variable) ||
      (metric.divideBy !== undefined && isHabitVariable(metric.divideBy)),
  );
}

function HabitFilterField({
  widget,
  onChange,
}: {
  widget: WidgetConfig;
  onChange: (change: WidgetChange) => void;
}) {
  const habits = useHabits();
  const selected = widget.habitFilter.kind === "habit" ? widget.habitFilter.habitId : undefined;
  const known = habits.data?.some(({ id }) => id === selected) ?? true;
  const options = [
    { value: ALL_HABITS, label: "Todos os hábitos" },
    ...(habits.data ?? []).map(({ id, title }) => ({ value: String(id), label: title })),
    ...(selected !== undefined && !known
      ? [{ value: String(selected), label: "Hábito excluído" }]
      : []),
  ];

  return (
    <SelectField
      label="Hábitos"
      value={selected === undefined ? ALL_HABITS : String(selected)}
      options={options}
      hint={!known ? "Esse hábito foi excluído. Escolha outro." : undefined}
      onChange={(next) =>
        onChange((current) => ({
          ...current,
          habitFilter:
            next === ALL_HABITS ? { kind: "all" } : { kind: "habit", habitId: Number(next) },
        }))
      }
    />
  );
}

function PeriodFields({
  widget,
  today,
  onChange,
}: {
  widget: WidgetConfig;
  today: DateOnly;
  onChange: (change: WidgetChange) => void;
}) {
  const fromId = useId();
  const toId = useId();
  const { period } = widget;
  return (
    <div className="grid gap-3">
      <SelectField
        label="Período"
        value={periodValue(period)}
        options={PERIOD_OPTIONS}
        onChange={(next) =>
          onChange((current) => ({
            ...current,
            period: periodFromValue(next, current.period, today),
          }))
        }
      />
      {period.kind === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={fromId}>De</Label>
            <Input
              id={fromId}
              type="date"
              value={period.from}
              onChange={(event) => {
                const from = event.target.value as DateOnly;
                onChange((current) => withCustomDay(current, { from }));
              }}
              className="h-11 sm:h-9"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={toId}>Até</Label>
            <Input
              id={toId}
              type="date"
              value={period.to}
              onChange={(event) => {
                const to = event.target.value as DateOnly;
                onChange((current) => withCustomDay(current, { to }));
              }}
              className="h-11 sm:h-9"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Preview({
  widget,
  today,
  tasksSeed,
}: {
  widget: WidgetConfig;
  today: DateOnly;
  tasksSeed?: ServerSeed<Task[]>;
}) {
  const sources = useDashboardSources([widget], today, tasksSeed);
  return (
    <WidgetCard
      widget={widget}
      state={widgetState(widget, sources, today)}
      chartHeight={PREVIEW_CHART_HEIGHT}
    />
  );
}

export type WidgetDraft = { sectionId: string; widget: WidgetConfig };

type WidgetEditorProps = {
  /** The widget as it is now (or a new one), and its section. */
  initial: WidgetDraft;
  isNew: boolean;
  sections: readonly DashboardSection[];
  today: DateOnly;
  tasksSeed?: ServerSeed<Task[]>;
  onSave: (draft: WidgetDraft) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * The guided builder (D26): metric, optional "A ÷ B in %", habit filter, grouping, period, chart type,
 * colors, section and size, with a live preview from the user's own data. Mount it only while open.
 */
export function WidgetEditor({
  initial,
  isNew,
  sections,
  today,
  tasksSeed,
  onSave,
  onDelete,
  onClose,
}: WidgetEditorProps) {
  const titleId = useId();
  const chartLabelId = useId();
  const errorsId = useId();
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const { widget } = draft;
  const errors = widgetErrors(widget);

  function update(change: WidgetChange) {
    setDraft((current) => ({ ...current, widget: change(current.widget) }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length === 0)
      onSave({ ...draft, widget: { ...widget, title: widget.title.trim() } });
  }

  const stackable = STACKABLE.includes(widget.chart) && widget.series.length > 1;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo gráfico" : "Editar gráfico"}</DialogTitle>
          <DialogDescription>
            Escolha o que medir e como mostrar. A prévia usa os seus dados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-6">
          {/* Own box for the two columns: the sticky preview must not slide over the footer. */}
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="order-1 grid content-start gap-3 md:sticky md:top-0 md:order-2 md:self-start">
              <p className="text-sm font-medium">Prévia</p>
              <Preview widget={widget} today={today} tasksSeed={tasksSeed} />
              <div id={errorsId} aria-live="polite">
                {errors.length > 0 ? (
                  <ul
                    role={submitted ? "alert" : undefined}
                    className="grid gap-1 text-sm text-destructive"
                  >
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="order-2 grid content-start gap-5 md:order-1">
              <div className="grid gap-2">
                <Label htmlFor={titleId}>Título</Label>
                <Input
                  id={titleId}
                  value={widget.title}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(event) => {
                    const title = event.target.value;
                    update((current) => ({ ...current, title }));
                  }}
                  className="h-11 sm:h-9"
                />
              </div>

              <div className="grid gap-2">
                <p id={chartLabelId} className="text-sm leading-none font-medium">
                  Tipo de gráfico
                </p>
                <ToggleGroup
                  aria-labelledby={chartLabelId}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  className="flex-wrap"
                  value={[widget.chart]}
                  onValueChange={(value) => {
                    const next = value[0] as ChartType | undefined;
                    if (next && CHART_TYPES.includes(next))
                      update((current) => withChart(current, next));
                  }}
                >
                  {CHART_TYPES.map((chart) => (
                    <ToggleGroupItem key={chart} value={chart}>
                      {CHART_LABELS[chart]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <SeriesFields
                chart={widget.chart}
                series={widget.series}
                onChange={(change) =>
                  update((current) => ({ ...current, series: change(current.series) }))
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Agrupar"
                  value={widget.grouping}
                  options={GROUPING_OPTIONS}
                  onChange={(next) =>
                    update((current) => ({ ...current, grouping: next as Grouping }))
                  }
                />
                {usesHabits(widget) ? <HabitFilterField widget={widget} onChange={update} /> : null}
              </div>

              <PeriodFields widget={widget} today={today} onChange={update} />

              {stackable ? (
                <Label className="min-h-11 cursor-pointer font-normal sm:min-h-8">
                  <Checkbox
                    checked={widget.stacked === true}
                    onCheckedChange={(checked) => {
                      update((current) => {
                        const rest = withoutField(current, "stacked");
                        return checked ? { ...rest, stacked: true } : rest;
                      });
                    }}
                  />
                  Empilhar as métricas
                </Label>
              ) : null}

              <ColorField
                legend="Fundo do card"
                use="background"
                value={widget.background}
                onChange={(background) => {
                  update((current) => {
                    const rest = withoutField(current, "background");
                    return background === undefined ? rest : { ...rest, background };
                  });
                }}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Seção"
                  value={draft.sectionId}
                  options={sections.map(({ id, title }) => ({ value: id, label: title }))}
                  onChange={(sectionId) => setDraft((current) => ({ ...current, sectionId }))}
                />
                <SelectField
                  label="Largura"
                  value={String(widget.layout.w)}
                  options={WIDTH_OPTIONS}
                  onChange={(next) => {
                    const w = Number(next);
                    update((current) => ({
                      ...current,
                      layout: {
                        ...current.layout,
                        x: Math.min(current.layout.x, GRID_COLUMNS - w),
                        w,
                      },
                    }));
                  }}
                />
                <SelectField
                  label="Altura"
                  value={String(widget.layout.h)}
                  options={HEIGHT_OPTIONS}
                  onChange={(next) =>
                    update((current) => ({
                      ...current,
                      layout: { ...current.layout, h: Number(next) },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            {!isNew ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={onDelete}
              >
                <Trash2Icon aria-hidden />
                Excluir
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="h-11 sm:h-8" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-11 sm:h-8"
              aria-describedby={errors.length > 0 ? errorsId : undefined}
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
