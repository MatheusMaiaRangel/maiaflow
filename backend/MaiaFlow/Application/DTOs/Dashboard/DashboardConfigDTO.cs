using System.Text.Json.Serialization;

namespace MaiaFlow.Application.DTOs.Dashboard
{
    // The same shape as the front end's DashboardConfig (frontend/src/lib/widgets/config.ts, D26, D28).
    // Values such as chart types, groupings, variables and colors are plain strings checked by
    // DashboardValidator, so an unknown value is a 400 with a clear message instead of a binding error.
    // Optional fields are left out of responses when they are null, as the front end expects. Numbers must be
    // JSON numbers ("x": "1" is a 400), unlike the rest of the API, which accepts numbers in strings.

    /// <summary>The whole dashboard of a user: its sections, in order.</summary>
    /// <param name="Version">Format version. Only <c>1</c> exists.</param>
    /// <param name="Sections">At most 8 sections, with at most 30 widgets in total.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardConfigDTO(
        [property: JsonRequired] int Version,
        List<DashboardSectionDTO> Sections);

    /// <summary>A titled group of widgets laid out on a 4-column grid.</summary>
    /// <param name="Id">Unique in the dashboard; 1 to 40 of <c>a-z</c>, <c>0-9</c> and <c>-</c>.</param>
    /// <param name="Title">1 to 40 characters, not counting surrounding spaces.</param>
    /// <param name="Widgets">Widgets of the section; they may not overlap each other.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardSectionDTO(string Id, string Title, List<DashboardWidgetDTO> Widgets);

    /// <summary>One chart, number or list of the dashboard.</summary>
    /// <param name="Id">Unique in the whole dashboard; 1 to 40 of <c>a-z</c>, <c>0-9</c> and <c>-</c>.</param>
    /// <param name="Title">1 to 60 characters, not counting surrounding spaces.</param>
    /// <param name="Chart"><c>bar</c>, <c>line</c>, <c>area</c>, <c>donut</c>, <c>number</c>, <c>heatmap</c> or
    /// <c>list</c>.</param>
    /// <param name="Series">1 to 6 metrics drawn by the widget.</param>
    /// <param name="Grouping"><c>none</c>, <c>day</c>, <c>week</c>, <c>weekday</c> or <c>habit</c>.</param>
    /// <param name="Period">Days the widget looks at.</param>
    /// <param name="HabitFilter">Which habits the habit metrics look at.</param>
    /// <param name="Stacked">Bar and area charts: stack the series (counts only). Omitted when not set.</param>
    /// <param name="Background">Tint of the card (a palette name or <c>#rrggbb</c>). Omitted when not set.</param>
    /// <param name="Layout">Position and size in grid cells.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardWidgetDTO(
        string Id,
        string Title,
        string Chart,
        List<DashboardSeriesDTO> Series,
        string Grouping,
        DashboardPeriodDTO Period,
        DashboardHabitFilterDTO HabitFilter,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Stacked,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Background,
        DashboardLayoutDTO Layout);

    /// <summary>One metric of a widget and how it is drawn.</summary>
    /// <param name="Metric">What is measured.</param>
    /// <param name="Label">Name shown in legends; 1 to 40 characters.</param>
    /// <param name="Color">A palette name (<c>blue</c>, <c>orange</c>, <c>aqua</c>, <c>yellow</c>, <c>magenta</c>,
    /// <c>green</c>, <c>violet</c>, <c>red</c>, <c>done</c>, <c>missed</c>, <c>pending</c>) or <c>#rrggbb</c>.</param>
    /// <param name="Mark">Bar, line and area charts: draw this series as <c>bar</c>, <c>line</c> or <c>area</c>
    /// instead. Omitted when not set.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardSeriesDTO(
        DashboardMetricDTO Metric,
        string Label,
        string Color,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Mark);

    /// <summary>A variable, or "variable ÷ divideBy in %" when <c>divideBy</c> is set (both must be counts).</summary>
    /// <param name="Variable">Such as <c>tasks.completed</c> or <c>habits.completionRate</c>.</param>
    /// <param name="DivideBy">Divisor variable for a ratio. Omitted when not set.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardMetricDTO(
        string Variable,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? DivideBy);

    /// <summary>
    /// <c>last</c>: the last <c>days</c> days ending today. <c>next</c>: today and the next <c>days</c> − 1 days.
    /// <c>custom</c>: <c>from</c> to <c>to</c>, both included, at most 366 days.
    /// </summary>
    /// <param name="Kind"><c>last</c>, <c>next</c> or <c>custom</c>.</param>
    /// <param name="Days"><c>last</c> and <c>next</c> only: 7, 30 or 90. Omitted otherwise.</param>
    /// <param name="From"><c>custom</c> only: first day, <c>yyyy-MM-dd</c>. Omitted otherwise.</param>
    /// <param name="To"><c>custom</c> only: last day, <c>yyyy-MM-dd</c>. Omitted otherwise.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardPeriodDTO(
        string Kind,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Days,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? From,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? To);

    /// <summary>Which habits the habit variables look at; task variables ignore it.</summary>
    /// <param name="Kind"><c>all</c> or <c>habit</c>.</param>
    /// <param name="HabitId"><c>habit</c> only: id of the habit (any positive id; a deleted habit just shows
    /// nothing). Omitted otherwise.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardHabitFilterDTO(
        string Kind,
        [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? HabitId);

    /// <summary>Position and size in grid cells: <c>x</c> 0–3 and <c>x + w</c> ≤ 4, <c>y</c> 0–50, <c>h</c> 1–4.</summary>
    /// <param name="X">First column, 0-based.</param>
    /// <param name="Y">First row, 0-based.</param>
    /// <param name="W">Width in columns.</param>
    /// <param name="H">Height in rows.</param>
    [JsonNumberHandling(JsonNumberHandling.Strict)]
    public record DashboardLayoutDTO(
        [property: JsonRequired] int X,
        [property: JsonRequired] int Y,
        [property: JsonRequired] int W,
        [property: JsonRequired] int H);
}
