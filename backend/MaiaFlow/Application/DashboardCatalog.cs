using System.Collections.Frozen;

namespace MaiaFlow.Application
{
    /// <summary>
    /// The known values of a dashboard configuration, mirroring the front end (<c>src/lib/metrics/types.ts</c>,
    /// <c>catalog.ts</c> and <c>src/lib/widgets/colors.ts</c>). Keep both sides in step (D28).
    /// </summary>
    public static class DashboardCatalog
    {
        public const string Count = "count";
        public const string Percent = "percent";
        public const string Streak = "streak";

        public const string TaskPrefix = "tasks.";
        public const string CurrentStreak = "habits.currentStreak";

        /// <summary>Every variable and its unit.</summary>
        public static readonly FrozenDictionary<string, string> VariableUnits = new Dictionary<string, string>
        {
            ["tasks.created"] = Count,
            ["tasks.completed"] = Count,
            ["tasks.completedOnTime"] = Count,
            ["tasks.completedLate"] = Count,
            ["tasks.completedWithDueDate"] = Count,
            ["tasks.completedWithoutDueDate"] = Count,
            ["tasks.openPending"] = Count,
            ["tasks.openOverdue"] = Count,
            ["tasks.openWithoutDueDate"] = Count,
            ["habits.scheduled"] = Count,
            ["habits.completed"] = Count,
            ["habits.notCompleted"] = Count,
            ["habits.pending"] = Count,
            ["habits.completionRate"] = Percent,
            [CurrentStreak] = Streak,
        }.ToFrozenDictionary(StringComparer.Ordinal);

        public static readonly FrozenSet<string> Charts =
            new[] { "bar", "line", "area", "donut", "number", "heatmap", "list" }.ToFrozenSet(StringComparer.Ordinal);

        public static readonly FrozenSet<string> Groupings =
            new[] { "none", "day", "week", "weekday", "habit" }.ToFrozenSet(StringComparer.Ordinal);

        public static readonly FrozenSet<string> Marks =
            new[] { "bar", "line", "area" }.ToFrozenSet(StringComparer.Ordinal);

        public static readonly FrozenSet<string> PaletteColors = new[]
        {
            "blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red", "done", "missed", "pending"
        }.ToFrozenSet(StringComparer.Ordinal);

        public static readonly IReadOnlyList<int> PeriodPresets = [7, 30, 90];

        public static bool IsTaskVariable(string variable) => variable.StartsWith(TaskPrefix, StringComparison.Ordinal);
    }
}
