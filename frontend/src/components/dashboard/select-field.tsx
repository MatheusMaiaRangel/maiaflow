"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };
export type SelectGroupOptions = { label: string; options: readonly SelectOption[] };

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Plain options, or groups with a heading each. */
  options: readonly SelectOption[] | readonly SelectGroupOptions[];
  hint?: string;
};

function isGrouped(
  options: readonly SelectOption[] | readonly SelectGroupOptions[],
): options is readonly SelectGroupOptions[] {
  return options.length > 0 && "options" in options[0];
}

/** Label + select (+ an optional hint under it), for the dashboard editor. */
export function SelectField({ label, value, onChange, options, hint }: SelectFieldProps) {
  const id = useId();
  const hintId = useId();
  const groups = isGrouped(options) ? options : [{ label: "", options }];
  const items = groups.flatMap((group) => group.options);

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <SelectTrigger
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className="h-11 w-full sm:h-9"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {groups.map((group) =>
            group.label ? (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="min-h-9">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : (
              group.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="min-h-9">
                  {option.label}
                </SelectItem>
              ))
            ),
          )}
        </SelectContent>
      </Select>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
