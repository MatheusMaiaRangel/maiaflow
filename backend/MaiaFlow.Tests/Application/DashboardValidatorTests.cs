using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Dashboard;

namespace MaiaFlow.Tests.Application
{
    public class DashboardValidatorTests
    {
        private static DashboardSeriesDTO Series(string variable = "tasks.completed", string? divideBy = null) =>
            new(new DashboardMetricDTO(variable, divideBy), "Série", "blue", null);

        private static DashboardWidgetDTO Widget(string id = "w1", int x = 0, int y = 0, int w = 2, int h = 1) =>
            new(id, "Gráfico", "bar", [Series()], "day", new DashboardPeriodDTO("last", 30, null, null),
                new DashboardHabitFilterDTO("all", null), null, null, new DashboardLayoutDTO(x, y, w, h));

        private static DashboardConfigDTO Config(params DashboardWidgetDTO[] widgets) =>
            new(1, [new DashboardSectionDTO("s1", "Seção", [.. widgets])]);

        public static TheoryData<string> CaseNames => DashboardCases.Names();

        [Theory]
        [MemberData(nameof(CaseNames))]
        public void Shared_case_has_the_expected_outcome(string name)
        {
            var sharedCase = DashboardCases.Get(name);

            var errors = DashboardCases.Errors(sharedCase.Config);

            if (sharedCase.Valid) Assert.Empty(errors);
            else Assert.NotEmpty(errors);
        }

        [Fact]
        public void Stops_at_the_size_limits_instead_of_checking_every_widget()
        {
            var widgets = Enumerable.Range(0, 2000).Select(index => Widget($"w{index}", y: index)).ToArray();

            var errors = DashboardValidator.Validate(Config(widgets));

            Assert.Equal(["Use no máximo 30 gráficos."], errors);
        }

        [Fact]
        public void Refuses_control_characters_in_texts()
        {
            var widget = Widget() with { Title = "Grá\u0000fico" };

            Assert.Contains("Os textos não podem ter caracteres de controle.", DashboardValidator.Validate(Config(widget)).Single());
        }

        [Fact]
        public void Shared_cases_have_unique_names_and_both_outcomes()
        {
            Assert.Equal(DashboardCases.All.Count, DashboardCases.All.Select(c => c.Name).Distinct().Count());
            Assert.Contains(DashboardCases.All, c => c.Valid);
            Assert.Contains(DashboardCases.All, c => !c.Valid);
        }

        [Fact]
        public void Numbers_written_as_strings_do_not_bind()
        {
            var valid = DashboardCases.Get("minimal bar chart").Config.GetRawText();
            var quoted = System.Text.Json.JsonDocument.Parse(valid.Replace("\"x\": 0", "\"x\": \"0\"").Replace("\"x\":0", "\"x\":\"0\""));

            Assert.Empty(DashboardCases.Errors(DashboardCases.Get("minimal bar chart").Config));
            Assert.StartsWith("binding:", Assert.Single(DashboardCases.Errors(quoted.RootElement)));
        }

        [Fact]
        public void A_valid_config_has_no_errors()
        {
            Assert.Empty(DashboardValidator.Validate(Config(Widget())));
        }

        [Fact]
        public void Errors_name_the_section_and_widget_by_title()
        {
            var errors = DashboardValidator.Validate(Config(Widget() with { Grouping = "month" }));

            Assert.Equal(["Seção \"Seção\", Gráfico \"Gráfico\": Agrupamento desconhecido."], errors);
        }

        [Fact]
        public void Errors_name_the_widget_by_position_when_its_title_is_unusable()
        {
            var errors = DashboardValidator.Validate(Config(Widget(), Widget("w2", x: 2) with { Title = " " }));

            Assert.Equal(["Seção \"Seção\", Gráfico 2: O título precisa ter de 1 a 60 caracteres."], errors);
        }

        [Fact]
        public void Overlapping_widgets_in_one_section_are_reported_once()
        {
            var errors = DashboardValidator.Validate(Config(Widget("a"), Widget("b", x: 1), Widget("c", x: 1, w: 3)));

            Assert.Equal(["Seção \"Seção\": há gráficos sobrepostos."], errors);
        }

        [Fact]
        public void Touching_widgets_do_not_overlap()
        {
            Assert.Empty(DashboardValidator.Validate(Config(Widget("a", w: 2, h: 2), Widget("b", x: 2), Widget("c", y: 2))));
        }

        [Fact]
        public void An_invalid_layout_is_reported_but_not_checked_for_overlaps()
        {
            var errors = DashboardValidator.Validate(Config(Widget("a"), Widget("b", w: 9)));

            Assert.Equal(["Seção \"Seção\", Gráfico \"Gráfico\": Posição ou tamanho inválido."], errors);
        }

        [Fact]
        public void Missing_parts_are_reported_instead_of_throwing()
        {
            Assert.Equal(["Informe o painel."], DashboardValidator.Validate(null));
            Assert.Equal(["Informe as seções do painel."], DashboardValidator.Validate(new DashboardConfigDTO(1, null!)));
            Assert.NotEmpty(DashboardValidator.Validate(new DashboardConfigDTO(1, [null!])));
            Assert.NotEmpty(DashboardValidator.Validate(new DashboardConfigDTO(1, [new DashboardSectionDTO(null!, null!, null!)])));
            Assert.Equal(["Gráfico inválido."], DashboardValidator.WidgetErrors(null));

            var empty = new DashboardWidgetDTO(null!, null!, "bar", null!, null!, null!, null!, null, null, null!);
            Assert.Equal(
                ["Identificador inválido.", "O título precisa ter de 1 a 60 caracteres.", "Escolha pelo menos uma métrica.",
                 "Agrupamento desconhecido.", "Período desconhecido.", "Filtro de hábitos desconhecido.",
                 "Posição ou tamanho inválido."],
                DashboardValidator.WidgetErrors(empty));
        }

        [Fact]
        public void A_series_without_a_metric_is_an_unknown_metric()
        {
            var widget = Widget() with { Series = [null!, new DashboardSeriesDTO(null!, null!, null!, null)] };

            var errors = DashboardValidator.WidgetErrors(widget);

            Assert.Contains("Métrica desconhecida.", errors);
            Assert.Contains("Cor inválida.", errors);
            Assert.Contains("Cada métrica precisa de um nome de 1 a 40 caracteres.", errors);
        }

        [Fact]
        public void An_unknown_metric_stops_the_query_checks_but_still_checks_the_layout()
        {
            var widget = Widget(w: 0) with { Series = [Series("tasks.deleted")], Grouping = "month" };

            Assert.Equal(["Métrica desconhecida.", "Posição ou tamanho inválido."], DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void An_unknown_chart_stops_every_other_check()
        {
            var widget = Widget(w: 0) with { Chart = "pie", Grouping = "month" };

            Assert.Equal(["Tipo de gráfico desconhecido."], DashboardValidator.WidgetErrors(widget));
        }

        [Theory]
        [InlineData("﻿")]
        [InlineData(" \t\n ")]
        [InlineData("  ")]
        public void Titles_made_of_javascript_whitespace_are_blank(string title)
        {
            Assert.Contains("O título precisa ter de 1 a 60 caracteres.", DashboardValidator.WidgetErrors(Widget() with { Title = title }));
        }

        [Fact]
        public void Next_line_is_not_whitespace_for_javascript_but_is_a_control_character()
        {
            // JavaScript's trim() keeps U+0085, so the length is fine; only the control-character rule refuses it.
            Assert.Equal(
                ["Os textos não podem ter caracteres de controle."],
                DashboardValidator.WidgetErrors(Widget() with { Title = "\u0085" }));
        }

        [Theory]
        [InlineData("blue\n")]
        [InlineData("#a1b2c3\n")]
        [InlineData("Blue")]
        public void Colors_must_match_exactly(string color)
        {
            var widget = Widget() with { Series = [Series() with { Color = color }] };

            Assert.Contains("Cor inválida.", DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void Ids_must_match_exactly()
        {
            Assert.Contains("Identificador inválido.", DashboardValidator.WidgetErrors(Widget("w1\n")));
        }

        [Theory]
        [InlineData("2026-02-29")]
        [InlineData("2026-13-01")]
        [InlineData("2026-1-01")]
        [InlineData("２０２６-01-01")]
        [InlineData("2026-01-01T00:00:00")]
        public void Custom_periods_need_real_days_in_iso_format(string from)
        {
            var widget = Widget() with { Period = new DashboardPeriodDTO("custom", null, from, "2026-03-01") };

            Assert.Contains("Informe datas válidas.", DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void A_leap_day_is_a_real_day()
        {
            var widget = Widget() with { Period = new DashboardPeriodDTO("custom", null, "2028-02-29", "2028-03-01") };

            Assert.Empty(DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void A_preset_period_needs_its_days()
        {
            var widget = Widget() with { Period = new DashboardPeriodDTO("next", null, null, null) };

            Assert.Contains("Escolha 7, 30 ou 90 dias.", DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void A_habit_filter_needs_a_habit_id()
        {
            var widget = Widget() with { HabitFilter = new DashboardHabitFilterDTO("habit", null) };

            Assert.Contains("Hábito inválido.", DashboardValidator.WidgetErrors(widget));
        }

        [Fact]
        public void Validate_lists_the_errors_of_every_widget()
        {
            var config = Config(Widget("a") with { Grouping = "x" }, Widget("b", x: 2) with { Grouping = "x" });

            Assert.Equal(2, DashboardValidator.Validate(config).Count);
        }
    }
}
