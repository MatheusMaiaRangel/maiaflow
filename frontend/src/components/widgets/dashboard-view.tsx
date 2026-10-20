"use client";

import { useId, useMemo } from "react";
import type { DateOnly } from "@/lib/dates";
import type { ServerSeed } from "@/lib/query-seed";
import type { Task } from "@/lib/tasks/hooks";
import type { DashboardConfig, DashboardSection, WidgetConfig } from "@/lib/widgets/config";
import { useDashboardSources, widgetState, type DashboardSources } from "@/lib/widgets/data";
import { WidgetCard } from "./widget-card";

/** Reading order on narrow screens: row by row, left to right. */
function byPosition(a: WidgetConfig, b: WidgetConfig): number {
  return a.layout.y - b.layout.y || a.layout.x - b.layout.x;
}

function Section({
  section,
  sources,
  today,
}: {
  section: DashboardSection;
  sources: DashboardSources;
  today: DateOnly;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-3">
      <h3 id={headingId} className="text-base font-semibold tracking-tight">
        {section.title}
      </h3>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {section.widgets.toSorted(byPosition).map((widget) => (
          <WidgetCard key={widget.id} widget={widget} state={widgetState(widget, sources, today)} />
        ))}
      </div>
    </section>
  );
}

/**
 * The configurable part of the Today dashboard: sections of widgets, each computed by the metrics engine
 * from data loaded once for all of them.
 */
export function DashboardView({
  config,
  today,
  tasksSeed,
}: {
  config: DashboardConfig;
  today: DateOnly;
  tasksSeed?: ServerSeed<Task[]>;
}) {
  const widgets = useMemo(() => config.sections.flatMap((section) => section.widgets), [config]);
  const sources = useDashboardSources(widgets, today, tasksSeed);

  return (
    <div className="grid min-w-0 gap-6">
      {config.sections.map((section) => (
        <Section key={section.id} section={section} sources={sources} today={today} />
      ))}
    </div>
  );
}
