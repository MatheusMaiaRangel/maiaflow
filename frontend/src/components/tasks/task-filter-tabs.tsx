import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FILTER_LABELS, TASK_FILTERS, isTaskFilter, type TaskFilter } from "@/lib/tasks/view";

type TaskFilterTabsProps = {
  value: TaskFilter;
  counts: Record<TaskFilter, number>;
  onChange: (filter: TaskFilter) => void;
};

/** Segmented control to filter tasks by status; scrolls sideways on narrow screens. */
export function TaskFilterTabs({ value, counts, onChange }: TaskFilterTabsProps) {
  return (
    <Tabs value={value} onValueChange={(next) => isTaskFilter(next) && onChange(next)}>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <TabsList aria-label="Filtrar tarefas por status" className="h-11! w-max sm:h-9!">
          {TASK_FILTERS.map((filter) => (
            <TabsTrigger
              key={filter}
              value={filter}
              className="px-3"
              aria-label={`${FILTER_LABELS[filter]} (${counts[filter]})`}
            >
              {FILTER_LABELS[filter]}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[filter]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
