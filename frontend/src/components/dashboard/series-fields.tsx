"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VARIABLE_INFO } from "@/lib/metrics/catalog";
import type { Variable } from "@/lib/metrics/types";
import { PALETTE_COLORS } from "@/lib/widgets/colors";
import {
  MAX_LABEL_LENGTH,
  MAX_SERIES,
  type ChartType,
  type SeriesConfig,
} from "@/lib/widgets/config";
import {
  autoLabel,
  COUNT_VARIABLE_GROUPS,
  isCountVariable,
  MARK_LABELS,
  VARIABLE_GROUPS,
} from "@/lib/widgets/labels";
import { withoutField } from "@/lib/widgets/edit";
import { ColorField } from "./color-field";
import { SelectField } from "./select-field";

const SAME_AS_CHART = "chart";
const CARTESIAN: readonly ChartType[] = ["bar", "line", "area"];

const MARK_OPTIONS = [
  { value: SAME_AS_CHART, label: "Igual ao gráfico" },
  ...Object.entries(MARK_LABELS).map(([value, label]) => ({ value, label })),
];

/** Keeps a name the user typed; a name that still matches the old metric follows the new one. */
function withMetric(series: SeriesConfig, metric: SeriesConfig["metric"]): SeriesConfig {
  const label = series.label === autoLabel(series.metric) ? autoLabel(metric) : series.label;
  return { ...series, metric, label };
}

type SeriesRowProps = {
  index: number;
  series: SeriesConfig;
  chart: ChartType;
  showMark: boolean;
  canRemove: boolean;
  /** Gets a function of the current series, so a change never starts from an older copy. */
  onChange: (change: (series: SeriesConfig) => SeriesConfig) => void;
  onRemove: () => void;
};

function SeriesRow({
  index,
  series,
  chart,
  showMark,
  canRemove,
  onChange,
  onRemove,
}: SeriesRowProps) {
  const labelId = useId();
  const { variable, divideBy } = series.metric;
  const number = index + 1;

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Métrica {number}</legend>
      <SelectField
        label="O que medir"
        value={variable}
        options={VARIABLE_GROUPS}
        hint={VARIABLE_INFO[variable].description}
        onChange={(next) => {
          const nextVariable = next as Variable;
          onChange((current) => {
            const currentDivisor = current.metric.divideBy;
            const keepsRatio = currentDivisor !== undefined && isCountVariable(nextVariable);
            return withMetric(current, {
              variable: nextVariable,
              ...(keepsRatio ? { divideBy: currentDivisor } : {}),
            });
          });
        }}
      />
      {isCountVariable(variable) ? (
        <Label className="min-h-11 cursor-pointer font-normal sm:min-h-8">
          <Checkbox
            checked={divideBy !== undefined}
            onCheckedChange={(checked) =>
              onChange((current) => {
                const { variable: dividend } = current.metric;
                const divisor =
                  dividend === "tasks.completed" ? "tasks.created" : "tasks.completed";
                return withMetric(
                  current,
                  checked ? { variable: dividend, divideBy: divisor } : { variable: dividend },
                );
              })
            }
          />
          Dividir por outra métrica (A ÷ B em %)
        </Label>
      ) : null}
      {divideBy !== undefined ? (
        <SelectField
          label="Dividir por"
          value={divideBy}
          options={COUNT_VARIABLE_GROUPS}
          hint={VARIABLE_INFO[divideBy].description}
          onChange={(next) =>
            onChange((current) =>
              withMetric(current, {
                variable: current.metric.variable,
                divideBy: next as Variable,
              }),
            )
          }
        />
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={labelId}>Nome na legenda</Label>
        <Input
          id={labelId}
          value={series.label}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => {
            const label = event.target.value;
            onChange((current) => ({ ...current, label }));
          }}
          className="h-11 sm:h-9"
        />
      </div>
      {showMark && CARTESIAN.includes(chart) ? (
        <SelectField
          label="Desenhar como"
          value={series.mark ?? SAME_AS_CHART}
          options={MARK_OPTIONS}
          onChange={(next) =>
            onChange((current) => {
              const rest = withoutField(current, "mark");
              return next === SAME_AS_CHART
                ? rest
                : { ...rest, mark: next as SeriesConfig["mark"] };
            })
          }
        />
      ) : null}
      <ColorField
        legend={`Cor da métrica ${number}`}
        use="series"
        value={series.color}
        onChange={(color) => onChange((current) => ({ ...current, color: color ?? "blue" }))}
      />
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden />
          Remover métrica {number}
        </Button>
      ) : null}
    </fieldset>
  );
}

type SeriesFieldsProps = {
  chart: ChartType;
  series: readonly SeriesConfig[];
  /** Gets a function of the current list, so a change never starts from an older copy. */
  onChange: (change: (series: readonly SeriesConfig[]) => SeriesConfig[]) => void;
};

/** The metrics of a widget: what each one measures, its name, how it is drawn and its color. */
export function SeriesFields({ chart, series, onChange }: SeriesFieldsProps) {
  const single = chart === "number" || chart === "heatmap";

  function add() {
    const used = new Set(series.map(({ color }) => color));
    const color = PALETTE_COLORS.find((candidate) => !used.has(candidate)) ?? "blue";
    const metric = { variable: series.at(-1)?.metric.variable ?? ("tasks.completed" as Variable) };
    onChange((current) => [...current, { metric, label: autoLabel(metric), color }]);
  }

  return (
    <div className="grid gap-3">
      {series.map((item, index) => (
        <SeriesRow
          key={index}
          index={index}
          series={item}
          chart={chart}
          showMark={series.length > 1}
          canRemove={series.length > 1}
          onChange={(change) =>
            onChange((current) =>
              current.map((other, at) => (at === index ? change(other) : other)),
            )
          }
          onRemove={() => onChange((current) => current.filter((_, at) => at !== index))}
        />
      ))}
      {!single && series.length < MAX_SERIES ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={add}
        >
          <PlusIcon aria-hidden />
          Adicionar métrica
        </Button>
      ) : null}
    </div>
  );
}
