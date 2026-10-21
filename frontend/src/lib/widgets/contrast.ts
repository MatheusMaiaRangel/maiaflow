/**
 * Contrast warnings for custom (hex) series colors. Palette colors have steps tuned for each theme; a hex
 * color is the same in both, so the builder warns when it nearly disappears on the card in either theme.
 * Card backgrounds need no warning: the tint is only 14 % of the color, which keeps the text readable.
 */
import type { HexColor } from "./colors";

/** The card color of each theme (`--card` in `globals.css`: white, and neutral-900 in dark mode). */
const CARD = { light: "#ffffff", dark: "#171717" } as const;
/** WCAG minimum for graphics (bars, lines) against their background. */
export const MIN_GRAPHIC_CONTRAST = 3;

type Rgb = [number, number, number];
export type Theme = keyof typeof CARD;
export type ContrastIssue = { theme: Theme; ratio: number };

function rgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function ratio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Contrast ratio between two `#rrggbb` colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  return ratio(rgb(a), rgb(b));
}

const THEMES: readonly Theme[] = ["light", "dark"];

/** Themes where a series color is too close to the card (bars and lines would fade). */
export function seriesContrastIssues(color: HexColor): ContrastIssue[] {
  return THEMES.map((theme) => ({ theme, ratio: contrastRatio(color, CARD[theme]) })).filter(
    ({ ratio: value }) => value < MIN_GRAPHIC_CONTRAST,
  );
}

const THEME_LABELS: Readonly<Record<Theme, string>> = { light: "claro", dark: "escuro" };

/** "Pouco contraste no modo claro (1,3:1)." — empty string when there is no issue. */
export function describeContrastIssues(issues: readonly ContrastIssue[]): string {
  if (issues.length === 0) return "";
  const parts = issues.map(
    ({ theme, ratio: value }) =>
      `no modo ${THEME_LABELS[theme]} (${value.toFixed(1).replace(".", ",")}:1)`,
  );
  return `Pouco contraste ${parts.join(" e ")}.`;
}
