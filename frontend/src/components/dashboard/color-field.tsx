"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  cssColor,
  isColorRef,
  isPaletteColor,
  PALETTE_COLORS,
  PALETTE_LABELS,
  type ColorRef,
  type HexColor,
} from "@/lib/widgets/colors";
import { describeContrastIssues, seriesContrastIssues } from "@/lib/widgets/contrast";
import { cn } from "@/lib/utils";

const HEX_INPUT = /^#[0-9a-f]{6}$/i;
const CUSTOM = "custom";
const NONE = "none";

type ColorFieldProps = {
  legend: string;
  value: ColorRef | undefined;
  onChange: (color: ColorRef | undefined) => void;
  /** `series`: bars and lines on the card. `background`: a tint behind the card's text, may be empty. */
  use: "series" | "background";
};

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="block size-6 rounded-md border border-foreground/15"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Palette color (with light and dark steps) or a custom hex color, as radio buttons. A custom series color
 * warns when it would fade on the card in either theme.
 */
export function ColorField({ legend, value, onChange, use }: ColorFieldProps) {
  const name = useId();
  const hexId = useId();
  const warningId = useId();
  const isCustom = value !== undefined && !isPaletteColor(value);
  const [hexText, setHexText] = useState<string>(isCustom ? value : "#");
  // When the color changes from outside (another series moved into this row), the hex field follows it.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setHexText(isCustom ? value : "#");
  }

  const selected = value === undefined ? NONE : isCustom ? CUSTOM : value;
  const issues =
    use === "series" && isCustom && isColorRef(value)
      ? seriesContrastIssues(value as HexColor)
      : [];
  const warning = describeContrastIssues(issues);

  function changeHex(text: string) {
    setHexText(text);
    if (HEX_INPUT.test(text)) onChange(text.toLowerCase() as HexColor);
  }

  const options: { key: string; label: string; color?: string }[] = [
    ...(use === "background" ? [{ key: NONE, label: "Nenhuma" }] : []),
    ...PALETTE_COLORS.map((color) => ({
      key: color,
      label: PALETTE_LABELS[color],
      color: cssColor(color),
    })),
  ];

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((option) => (
          <label
            key={option.key}
            title={option.label}
            className={cn(
              "grid cursor-pointer place-items-center rounded-lg border-2 border-transparent p-0.5",
              "has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              aria-label={option.label}
              checked={selected === option.key}
              onChange={() => onChange(option.key === NONE ? undefined : (option.key as ColorRef))}
              className="sr-only"
            />
            {option.color ? (
              <Swatch color={option.color} />
            ) : (
              <span aria-hidden className="px-1.5 text-xs leading-6 text-muted-foreground">
                Nenhuma
              </span>
            )}
          </label>
        ))}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-transparent px-1.5 py-0.5 text-xs",
            "has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          )}
        >
          <input
            type="radio"
            name={name}
            value={CUSTOM}
            aria-label="Personalizada"
            checked={selected === CUSTOM}
            onChange={() => {
              if (HEX_INPUT.test(hexText)) onChange(hexText.toLowerCase() as HexColor);
              else document.getElementById(hexId)?.focus();
            }}
            className="sr-only"
          />
          <Swatch color={isCustom ? cssColor(value) : "transparent"} />
          Personalizada
        </label>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={hexId} className="text-xs text-muted-foreground">
          Cor hex
        </label>
        <Input
          id={hexId}
          value={hexText}
          onChange={(event) => changeHex(event.target.value.trim())}
          placeholder="#2a78d6"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={hexText.length > 1 && !HEX_INPUT.test(hexText)}
          aria-describedby={warning ? warningId : undefined}
          className="h-9 w-28 font-mono"
        />
        <input
          type="color"
          aria-label={`${legend}: escolher no seletor`}
          value={HEX_INPUT.test(hexText) ? hexText.toLowerCase() : "#2a78d6"}
          onChange={(event) => changeHex(event.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-1"
        />
      </div>
      <p
        id={warningId}
        aria-live="polite"
        className="min-h-4 text-xs text-amber-700 dark:text-amber-400"
      >
        {warning}
      </p>
    </fieldset>
  );
}
