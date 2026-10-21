using System.Globalization;
using System.Text.RegularExpressions;
using MaiaFlow.Application.DTOs.Dashboard;
using static MaiaFlow.Application.DashboardCatalog;

namespace MaiaFlow.Application
{
    /// <summary>
    /// Checks a dashboard with the same rules as the front end (<c>widgetErrors()</c> in
    /// <c>src/lib/widgets/config.ts</c>, <c>queryErrors()</c> and <c>periodError()</c> in <c>src/lib/metrics</c>),
    /// plus the dashboard-wide rules of D28. Both sides test against
    /// <c>contracts/dashboard-validation-cases.json</c>. Null parts are reported, never dereferenced, so the
    /// validator is safe on anything a JSON body can produce.
    /// </summary>
    public static partial class DashboardValidator
    {
        public const int SupportedVersion = 1;
        public const int MaxSections = 8;
        public const int MaxWidgets = 30;
        public const int MaxSectionTitleLength = 40;
        public const int MaxTitleLength = 60;
        public const int MaxLabelLength = 40;
        public const int MaxSeries = 6;
        public const int GridColumns = 4;
        public const int MaxRow = 50;
        public const int MaxRowsPerWidget = 4;
        public const int MaxPeriodDays = 366;

        // \z instead of $: in .NET, $ also matches before a final line break.
        [GeneratedRegex(@"^[a-z0-9-]{1,40}\z")]
        private static partial Regex IdPattern();

        [GeneratedRegex(@"^#[0-9a-fA-F]{6}\z")]
        private static partial Regex HexColorPattern();

        [GeneratedRegex(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}\z")]
        private static partial Regex DatePattern();

        /// <summary>Why the dashboard cannot be saved (Brazilian Portuguese); empty when it is valid.</summary>
        public static IReadOnlyList<string> Validate(DashboardConfigDTO? config)
        {
            if (config is null) return ["Informe o painel."];

            var errors = new List<string>();
            if (config.Version != SupportedVersion) errors.Add("Versão do painel desconhecida.");
            if (config.Sections is null) return [.. errors, "Informe as seções do painel."];

            if (config.Sections.Count > MaxSections) errors.Add($"Use no máximo {MaxSections} seções.");
            var widgets = config.Sections.SelectMany(section => section?.Widgets ?? []).ToList();
            if (widgets.Count > MaxWidgets) errors.Add($"Use no máximo {MaxWidgets} gráficos.");
            // Too big to be a real dashboard: checking every widget of a 64 KB body would only build a huge answer.
            if (errors.Count > 0) return errors;
            if (HasDuplicates(config.Sections.Select(section => section?.Id)))
                errors.Add("Duas seções têm o mesmo identificador.");
            if (HasDuplicates(widgets.Select(widget => widget?.Id)))
                errors.Add("Dois gráficos têm o mesmo identificador.");

            for (var index = 0; index < config.Sections.Count; index++)
                errors.AddRange(SectionErrors(config.Sections[index], index));
            return errors;
        }

        private static bool HasDuplicates(IEnumerable<string?> ids) =>
            ids.OfType<string>().GroupBy(id => id, StringComparer.Ordinal).Any(group => group.Count() > 1);

        private static IEnumerable<string> SectionErrors(DashboardSectionDTO? section, int index)
        {
            var name = Name("Seção", section?.Title, MaxSectionTitleLength, index);
            if (section is null) return [$"{name}: seção inválida."];

            var errors = new List<string>();
            if (!IsId(section.Id)) errors.Add($"{name}: identificador inválido.");
            if (!HasTrimmedLength(section.Title, MaxSectionTitleLength))
                errors.Add($"{name}: o título precisa ter de 1 a {MaxSectionTitleLength} caracteres.");
            if (HasControlCharacters(section.Title)) errors.Add($"{name}: {ControlCharactersMessage}");
            if (section.Widgets is null) return [.. errors, $"{name}: informe os gráficos."];

            for (var position = 0; position < section.Widgets.Count; position++)
            {
                var widget = section.Widgets[position];
                var widgetName = Name("Gráfico", widget?.Title, MaxTitleLength, position);
                errors.AddRange(WidgetErrors(widget).Select(error => $"{name}, {widgetName}: {error}"));
            }
            if (HasOverlap(section.Widgets)) errors.Add($"{name}: há gráficos sobrepostos.");
            return errors;
        }

        // "Seção "Tarefas"" when the title is usable, "Seção 2" otherwise (never echoes a long or blank title).
        private static string Name(string kind, string? title, int maxLength, int index) =>
            HasTrimmedLength(title, maxLength) ? $"{kind} \"{JsTrim(title!)}\"" : $"{kind} {index + 1}";

        /// <summary>Same checks and order as <c>widgetErrors()</c> on the front end.</summary>
        public static IReadOnlyList<string> WidgetErrors(DashboardWidgetDTO? widget)
        {
            if (widget is null) return ["Gráfico inválido."];

            var errors = new List<string>();
            if (!IsId(widget.Id)) errors.Add("Identificador inválido.");
            if (!HasTrimmedLength(widget.Title, MaxTitleLength))
                errors.Add($"O título precisa ter de 1 a {MaxTitleLength} caracteres.");
            if (widget.Chart is null || !Charts.Contains(widget.Chart)) return [.. errors, "Tipo de gráfico desconhecido."];

            var series = widget.Series ?? [];
            if (series.Count > MaxSeries) errors.Add($"Use no máximo {MaxSeries} métricas.");
            if (series.Any(s => s?.Label is not { } label || JsTrim(label).Length == 0 || label.Length > MaxLabelLength))
                errors.Add($"Cada métrica precisa de um nome de 1 a {MaxLabelLength} caracteres.");
            if (HasControlCharacters(widget.Title) || series.Any(s => HasControlCharacters(s?.Label)))
                errors.Add(ControlCharactersMessage);
            if (series.Any(s => !IsColor(s?.Color)) || (widget.Background is not null && !IsColor(widget.Background)))
                errors.Add("Cor inválida.");
            if (series.Any(s => s?.Mark is { } mark && !Marks.Contains(mark)))
                errors.Add("Desenho da métrica desconhecido.");

            var query = QueryErrors(widget, series);
            return query.Count > 0
                ? [.. errors, .. query, .. LayoutErrors(widget.Layout)]
                : [.. errors, .. ChartErrors(widget, series), .. LayoutErrors(widget.Layout)];
        }

        /// <summary>Same checks and order as <c>queryErrors()</c> in the metrics engine.</summary>
        private static List<string> QueryErrors(DashboardWidgetDTO widget, List<DashboardSeriesDTO> series)
        {
            var errors = new List<string>();
            var variables = series.SelectMany(VariablesOf).ToList();

            if (series.Count == 0) errors.Add("Escolha pelo menos uma métrica.");
            if (series.Any(s => s?.Metric is null) || variables.Any(variable => variable is null || !VariableUnits.ContainsKey(variable)))
                return [.. errors, "Métrica desconhecida."];

            var grouping = widget.Grouping;
            if (grouping is null || !Groupings.Contains(grouping)) errors.Add("Agrupamento desconhecido.");
            if (PeriodError(widget.Period) is { } period) errors.Add(period);
            if (HabitFilterError(widget.HabitFilter) is { } filter) errors.Add(filter);
            if (grouping == "habit" && variables.Any(variable => IsTaskVariable(variable!)))
                errors.Add("Agrupar por hábito só funciona com métricas de hábitos.");
            if (variables.Contains(CurrentStreak) && grouping != "none" && grouping != "habit")
                errors.Add("A sequência atual só pode ser vista no total ou por hábito.");
            if (series.Any(s => s.Metric.DivideBy is { } divisor
                                && (VariableUnits[s.Metric.Variable] != Count || VariableUnits[divisor] != Count)))
                errors.Add("A divisão só aceita contagens.");
            return errors;
        }

        // The variable and, for a ratio, the divisor. Null entries mark a missing variable.
        private static IEnumerable<string?> VariablesOf(DashboardSeriesDTO? series)
        {
            if (series?.Metric is not { } metric) yield break;
            yield return metric.Variable;
            if (metric.DivideBy is not null) yield return metric.DivideBy;
        }

        /// <summary>Same checks as <c>periodError()</c>, plus unknown kinds; <c>null</c> when the period is fine.</summary>
        private static string? PeriodError(DashboardPeriodDTO? period)
        {
            switch (period?.Kind)
            {
                case "last":
                case "next":
                    return period.Days is { } days && PeriodPresets.Contains(days) ? null : "Escolha 7, 30 ou 90 dias.";
                case "custom":
                    if (ParseDay(period.From) is not { } from || ParseDay(period.To) is not { } to)
                        return "Informe datas válidas.";
                    if (to < from) return "A data final deve ser depois da inicial.";
                    return to.DayNumber - from.DayNumber + 1 > MaxPeriodDays
                        ? $"O período pode ter no máximo {MaxPeriodDays} dias."
                        : null;
                default:
                    return "Período desconhecido.";
            }
        }

        private static DateOnly? ParseDay(string? value) =>
            value is not null && DatePattern().IsMatch(value)
            && DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
                ? day
                : null;

        private static string? HabitFilterError(DashboardHabitFilterDTO? filter) => filter?.Kind switch
        {
            "all" => null,
            "habit" => filter.HabitId is > 0 ? null : "Hábito inválido.",
            _ => "Filtro de hábitos desconhecido."
        };

        private static string SeriesUnit(DashboardSeriesDTO series) =>
            series.Metric.DivideBy is null ? VariableUnits[series.Metric.Variable] : Percent;

        /// <summary>Same rules as <c>chartErrors()</c>; only called once the query is valid.</summary>
        private static List<string> ChartErrors(DashboardWidgetDTO widget, List<DashboardSeriesDTO> series)
        {
            var units = series.Select(SeriesUnit).ToHashSet(StringComparer.Ordinal);
            var count = series.Count;
            var grouping = widget.Grouping;

            switch (widget.Chart)
            {
                case "number":
                    return count == 1 && grouping == "none" ? [] : ["O número mostra uma métrica, sem agrupamento."];
                case "heatmap":
                    return count == 1 && grouping == "day" ? [] : ["O mapa mostra uma métrica agrupada por dia."];
                case "donut":
                {
                    var slices = (grouping == "none" && count >= 2)
                                 || (count == 1 && grouping is "weekday" or "habit");
                    List<string> errors = slices
                        ? []
                        : ["A rosca precisa de várias métricas no total, ou uma por dia da semana ou por hábito."];
                    return units.Count == 1 && units.Contains(Count) ? errors : [.. errors, "A rosca só mostra contagens."];
                }
                case "bar":
                case "line":
                case "area":
                {
                    List<string> errors = units.Count > 1 ? ["As séries de um gráfico precisam da mesma unidade."] : [];
                    return widget.Stacked == true && !units.Contains(Count)
                        ? [.. errors, "Só contagens podem ser empilhadas."]
                        : errors;
                }
                default:
                    return [];
            }
        }

        private static IEnumerable<string> LayoutErrors(DashboardLayoutDTO? layout) =>
            IsValidLayout(layout) ? [] : ["Posição ou tamanho inválido."];

        private static bool IsValidLayout(DashboardLayoutDTO? layout) =>
            layout is { X: >= 0 and < GridColumns, W: >= 1 and <= GridColumns, Y: >= 0 and <= MaxRow, H: >= 1 and <= MaxRowsPerWidget }
            && layout.X + layout.W <= GridColumns;

        // Rectangles [x, x + w) × [y, y + h) of the widgets with a valid layout.
        private static bool HasOverlap(List<DashboardWidgetDTO> widgets)
        {
            var boxes = widgets.Select(widget => widget?.Layout).Where(IsValidLayout).Select(layout => layout!).ToList();
            return boxes.SelectMany((a, i) => boxes.Skip(i + 1).Select(b => (a, b))).Any(pair => Overlaps(pair.a, pair.b));
        }

        private static bool Overlaps(DashboardLayoutDTO a, DashboardLayoutDTO b) =>
            a.X < b.X + b.W && b.X < a.X + a.W && a.Y < b.Y + b.H && b.Y < a.Y + a.H;

        private static bool IsId(string? id) => id is not null && IdPattern().IsMatch(id);

        private const string ControlCharactersMessage = "Os textos não podem ter caracteres de controle.";

        // U+0000–U+001F and U+007F–U+009F, as /[\u0000-\u001f\u007f-\u009f]/ on the front end; PostgreSQL's
        // jsonb also refuses U+0000.
        private static bool HasControlCharacters(string? text) => text is not null && text.Any(char.IsControl);

        private static bool IsColor(string? color) =>
            color is not null && (PaletteColors.Contains(color) || HexColorPattern().IsMatch(color));

        private static bool HasTrimmedLength(string? text, int maxLength)
        {
            if (text is null) return false;
            var length = JsTrim(text).Length;
            return length > 0 && length <= maxLength;
        }

        // JavaScript's String.prototype.trim(), which the front end measures with: unlike string.Trim() it
        // removes U+FEFF and keeps U+0085.
        private static string JsTrim(string text)
        {
            var start = 0;
            var end = text.Length;
            while (start < end && IsJsWhiteSpace(text[start])) start++;
            while (end > start && IsJsWhiteSpace(text[end - 1])) end--;
            return text[start..end];
        }

        private static bool IsJsWhiteSpace(char c) => c == '\uFEFF' || (c != '\u0085' && char.IsWhiteSpace(c));
    }
}
