/**
 * The dashboard as the API stores it (D28), read into what the screen shows. Plain functions, so the server
 * (the Today seed) and the browser share them.
 */
import { dashboardErrors, type DashboardConfig } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import { parseDashboardConfig } from "./parse";

/** What the screen shows: the stored dashboard, or the default one when nothing usable is stored. */
export type Dashboard = { revision: number; config: DashboardConfig; isDefault: boolean };

/** Reads the API's answer. A stored configuration this version cannot use falls back to the default. */
export function toDashboard(dto: { revision: number; config?: unknown }): Dashboard {
  const parsed =
    dto.config === null || dto.config === undefined ? null : parseDashboardConfig(dto.config);
  const usable = parsed !== null && dashboardErrors(parsed).length === 0 ? parsed : null;
  if (dto.config != null && usable === null)
    console.warn("Stored dashboard cannot be used; showing the default");
  return {
    revision: dto.revision,
    config: usable ?? DEFAULT_DASHBOARD,
    isDefault: usable === null,
  };
}
