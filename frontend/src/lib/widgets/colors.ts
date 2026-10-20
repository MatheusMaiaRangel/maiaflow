/**
 * Widget colors: a named palette that has its own light and dark steps (CSS variables `--viz-*` in
 * `globals.css`), or a custom hex color. The eight hues follow a palette validated for color-blind
 * separation in both modes; `done`, `missed` and `pending` are the calendar's status colors.
 */

export const PALETTE_COLORS = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
  "done",
  "missed",
  "pending",
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];

/** `#rrggbb`. */
export type HexColor = `#${string}`;

export type ColorRef = PaletteColor | HexColor;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const PALETTE_LABELS: Readonly<Record<PaletteColor, string>> = {
  blue: "Azul",
  orange: "Laranja",
  aqua: "Verde-água",
  yellow: "Amarelo",
  magenta: "Rosa",
  green: "Verde",
  violet: "Violeta",
  red: "Vermelho",
  done: "Feito",
  missed: "Não feito",
  pending: "Pendente",
};

/**
 * Written out in full: Tailwind drops custom properties whose names it never sees in the sources, so a
 * name built at run time (`--viz-${color}`) would point at nothing.
 */
const PALETTE_CSS: Readonly<Record<PaletteColor, string>> = {
  blue: "var(--viz-blue)",
  orange: "var(--viz-orange)",
  aqua: "var(--viz-aqua)",
  yellow: "var(--viz-yellow)",
  magenta: "var(--viz-magenta)",
  green: "var(--viz-green)",
  violet: "var(--viz-violet)",
  red: "var(--viz-red)",
  done: "var(--viz-done)",
  missed: "var(--viz-missed)",
  pending: "var(--viz-pending)",
};

export function isPaletteColor(value: unknown): value is PaletteColor {
  return typeof value === "string" && (PALETTE_COLORS as readonly string[]).includes(value);
}

export function isColorRef(value: unknown): value is ColorRef {
  return isPaletteColor(value) || (typeof value === "string" && HEX_COLOR.test(value));
}

/** A CSS color for the reference. Hex colors are checked again here, so nothing else reaches a style. */
export function cssColor(color: ColorRef): string {
  if (isPaletteColor(color)) return PALETTE_CSS[color];
  if (HEX_COLOR.test(color)) return color;
  return "var(--viz-blue)";
}

/** `color` mixed into `base` (`share` 0–100), e.g. heatmap cells or a tinted card background. */
export function mixColor(color: ColorRef, share: number, base = "var(--card)"): string {
  const clamped = Math.min(100, Math.max(0, Math.round(share)));
  return `color-mix(in oklab, ${cssColor(color)} ${clamped}%, ${base})`;
}
