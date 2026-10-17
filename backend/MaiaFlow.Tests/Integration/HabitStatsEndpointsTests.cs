using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using static MaiaFlow.Tests.Integration.OwnershipTests;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    [Collection(ApiCollection.Name)]
    public class HabitStatsEndpointsTests(ApiFixture fixture)
    {
        private static readonly DateTime Today = new(2026, 10, 14);

        private const string C = "Completed";
        private const string N = "NotCompleted";
        private const string P = "Pending";

        private async Task<HttpClient> ClientAtTodayAsync()
        {
            // 12:00 in Brasília (UTC-3, no daylight saving), so "today" is unambiguous.
            var clock = new FakeTimeProvider(new DateTimeOffset(Today.AddHours(15), TimeSpan.Zero));
            clock.SetLocalTimeZone(BrazilTime.Zone);
            WebApplicationFactory<Program> factory = fixture.Factory.WithWebHostBuilder(b =>
                b.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));
            return await SignedInClientAsync(factory);
        }

        private static async Task<int> CreateDailyAsync(HttpClient client, string title, DateTime start) =>
            (await (await client.PostJsonAsync("/api/habits", DailyHabit(title, start))).ReadJsonAsync())
                .GetProperty("id").GetInt32();

        private static async Task<JsonElement> StatsAsync(HttpClient client, int? days = null)
        {
            var response = await client.GetAsync(days is null ? "/api/habits/stats" : $"/api/habits/stats?days={days}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.ReadJsonAsync();
        }

        // Sets the status of a habit's stored occurrences, oldest first, ending on the given day (default today).
        private static async Task SetStatusesAsync(HttpClient client, int habitId, string[] statuses, DateTime? last = null)
        {
            var end = last ?? Today;
            var start = end.AddDays(1 - statuses.Length);
            var occurrences = (await (await client.GetAsync(CalendarUrl(start, end))).ReadJsonAsync())
                .EnumerateArray().Where(o => o.GetProperty("habitId").GetInt32() == habitId).ToList();
            Assert.Equal(statuses.Length, occurrences.Count);

            foreach (var (occurrence, status) in occurrences.Zip(statuses))
            {
                if (status == P) continue;
                var response = await client.PatchJsonAsync(
                    $"/api/habits/occurrences/{occurrence.GetProperty("id").GetInt32()}/status", $$"""{"status":"{{status}}"}""");
                response.EnsureSuccessStatusCode();
            }
        }

        private static JsonElement Habit(JsonElement stats, int habitId) =>
            stats.GetProperty("habits").EnumerateArray().Single(h => h.GetProperty("habitId").GetInt32() == habitId);

        private static (string Date, int Completed, int NotCompleted, int Pending)[] Days(JsonElement stats) =>
            stats.GetProperty("days").EnumerateArray()
                .Select(d => (d.GetProperty("date").GetString()![..10], d.GetProperty("completed").GetInt32(),
                    d.GetProperty("notCompleted").GetInt32(), d.GetProperty("pending").GetInt32()))
                .ToArray();

        private static double? Rate(JsonElement item) =>
            item.GetProperty("completionRate").ValueKind == JsonValueKind.Null ? null : item.GetProperty("completionRate").GetDouble();

        private static (int Current, int Best) Streak(JsonElement item) =>
            (item.GetProperty("currentStreak").GetInt32(), item.GetProperty("bestStreak").GetInt32());

        [Fact]
        public async Task Stats_need_a_signed_in_user()
        {
            var response = await fixture.Factory.CreateClient().GetAsync("/api/habits/stats");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Theory]
        [InlineData("6")]
        [InlineData("91")]
        [InlineData("0")]
        [InlineData("-30")]
        public async Task Periods_outside_7_to_90_days_return_400_problem_details(string days)
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.GetAsync($"/api/habits/stats?days={days}");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("entre 7 e 90 dias", (await response.ReadJsonAsync()).GetProperty("detail").GetString());
        }

        [Fact]
        public async Task A_period_that_is_not_a_number_returns_400()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.GetAsync("/api/habits/stats?days=abc");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task The_default_period_is_the_last_30_days_ending_today_with_empty_days_included()
        {
            var client = await ClientAtTodayAsync();

            var stats = await StatsAsync(client);
            var days = Days(stats);

            Assert.StartsWith("2026-09-15", stats.GetProperty("start").GetString());
            Assert.StartsWith("2026-10-14", stats.GetProperty("end").GetString());
            Assert.Equal(30, days.Length);
            Assert.Equal("2026-09-15", days[0].Date);
            Assert.Equal("2026-10-14", days[^1].Date);
            Assert.All(days, d => Assert.Equal((0, 0, 0), (d.Completed, d.NotCompleted, d.Pending)));
            Assert.Equal(0, stats.GetProperty("habits").GetArrayLength());
        }

        [Theory]
        [InlineData(7, "2026-10-08")]
        [InlineData(90, "2026-07-17")]
        public async Task The_window_covers_exactly_the_requested_days(int length, string firstDay)
        {
            var client = await ClientAtTodayAsync();

            var days = Days(await StatsAsync(client, length));

            Assert.Equal(length, days.Length);
            Assert.Equal(firstDay, days[0].Date);
            Assert.Equal(length, days.Select(d => d.Date).Distinct().Count());
        }

        [Fact]
        public async Task Days_count_the_occurrences_of_all_habits_by_status()
        {
            var client = await ClientAtTodayAsync();
            var read = await CreateDailyAsync(client, "Ler", Today.AddDays(-2));
            var run = await CreateDailyAsync(client, "Correr", Today.AddDays(-2));
            await SetStatusesAsync(client, read, [C, C, P]);
            await SetStatusesAsync(client, run, [N, P, P]);

            var days = Days(await StatsAsync(client, 7));

            Assert.Equal(
                [
                    ("2026-10-08", 0, 0, 0), ("2026-10-09", 0, 0, 0), ("2026-10-10", 0, 0, 0), ("2026-10-11", 0, 0, 0),
                    ("2026-10-12", 1, 1, 0), ("2026-10-13", 1, 0, 1), ("2026-10-14", 0, 0, 2)
                ],
                days);
        }

        [Fact]
        public async Task Habit_totals_count_the_window_and_the_rate_leaves_out_today_while_pending()
        {
            var client = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(client, "Meditar", Today.AddDays(-3));
            await SetStatusesAsync(client, id, [C, C, N, P]);

            var pendingToday = Habit(await StatsAsync(client, 7), id);
            await SetStatusesAsync(client, id, [C]);
            var completedToday = Habit(await StatsAsync(client, 7), id);

            Assert.Equal("Meditar", pendingToday.GetProperty("habitTitle").GetString());
            Assert.Equal(4, pendingToday.GetProperty("scheduled").GetInt32());
            Assert.Equal(2, pendingToday.GetProperty("completed").GetInt32());
            Assert.Equal(1, pendingToday.GetProperty("notCompleted").GetInt32());
            Assert.Equal(1, pendingToday.GetProperty("pending").GetInt32());
            Assert.Equal(0.6667, Rate(pendingToday));
            Assert.Equal(0.75, Rate(completedToday));
        }

        [Fact]
        public async Task The_rate_is_null_when_only_today_is_pending_or_nothing_is_scheduled()
        {
            var client = await ClientAtTodayAsync();
            var startsToday = await CreateDailyAsync(client, "Hoje", Today);
            var startsLater = await CreateDailyAsync(client, "Futuro", Today.AddDays(3));

            var stats = await StatsAsync(client, 7);
            var later = Habit(stats, startsLater);

            Assert.Null(Rate(Habit(stats, startsToday)));
            Assert.Equal(1, Habit(stats, startsToday).GetProperty("scheduled").GetInt32());
            Assert.Null(Rate(later));
            Assert.Equal(0, later.GetProperty("scheduled").GetInt32());
            Assert.Equal((0, 0), Streak(later));
        }

        [Fact]
        public async Task A_not_completed_day_breaks_the_streak_and_today_pending_does_not()
        {
            var client = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(client, "Treinar", Today.AddDays(-6));
            await SetStatusesAsync(client, id, [C, C, C, N, C, C, P]);

            var whilePending = Streak(Habit(await StatsAsync(client, 7), id));
            await SetStatusesAsync(client, id, [N]);
            var afterMissingToday = Streak(Habit(await StatsAsync(client, 7), id));

            Assert.Equal((2, 3), whilePending);
            Assert.Equal((0, 3), afterMissingToday);
        }

        [Fact]
        public async Task A_past_day_left_pending_breaks_the_streak()
        {
            var client = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(client, "Estudar", Today.AddDays(-2));
            await SetStatusesAsync(client, id, [C, P, C]);

            Assert.Equal((1, 1), Streak(Habit(await StatsAsync(client, 7), id)));
        }

        [Fact]
        public async Task Streaks_look_back_beyond_the_window()
        {
            var client = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(client, "Beber água", Today.AddDays(-9));
            await SetStatusesAsync(client, id, [C, C, C, C, C, C, C, C, C, P]);

            var item = Habit(await StatsAsync(client, 7), id);

            Assert.Equal(7, item.GetProperty("scheduled").GetInt32());
            Assert.Equal((9, 9), Streak(item));
        }

        [Fact]
        public async Task Past_days_never_opened_in_the_calendar_are_generated_and_count_as_pending()
        {
            var client = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(client, "Alongar", Today.AddDays(-5));

            var stats = await StatsAsync(client, 7);
            var item = Habit(stats, id);
            var calendar = (await (await client.GetAsync(CalendarUrl(Today.AddDays(-5), Today))).ReadJsonAsync()).EnumerateArray();

            Assert.Equal(6, item.GetProperty("scheduled").GetInt32());
            Assert.Equal(6, item.GetProperty("pending").GetInt32());
            Assert.Equal(0.0, Rate(item));
            Assert.Equal([0, 1, 1, 1, 1, 1, 1], Days(stats).Select(d => d.Pending));
            Assert.All(calendar, o => Assert.True(o.GetProperty("id").GetInt32() > 0));
        }

        [Fact]
        public async Task Stats_only_contain_the_callers_habits()
        {
            var owner = await ClientAtTodayAsync();
            var other = await ClientAtTodayAsync();
            var id = await CreateDailyAsync(owner, "Privado", Today.AddDays(-2));
            await SetStatusesAsync(owner, id, [C, N, P]);

            var stats = await StatsAsync(other, 7);

            Assert.Equal(0, stats.GetProperty("habits").GetArrayLength());
            Assert.All(Days(stats), d => Assert.Equal((0, 0, 0), (d.Completed, d.NotCompleted, d.Pending)));
        }

        [Fact]
        public async Task Habits_come_in_the_same_order_as_the_habit_list()
        {
            var client = await ClientAtTodayAsync();
            await CreateDailyAsync(client, "Zumba", Today);
            await CreateDailyAsync(client, "Academia", Today.AddDays(-1));
            await CreateDailyAsync(client, "Música", Today.AddDays(2));

            var list = (await (await client.GetAsync("/api/habits")).ReadJsonAsync()).EnumerateArray()
                .Select(h => h.GetProperty("id").GetInt32());
            var stats = (await StatsAsync(client)).GetProperty("habits").EnumerateArray()
                .Select(h => h.GetProperty("habitId").GetInt32());

            Assert.Equal(list, stats);
            Assert.Equal(3, stats.Count());
        }
    }
}
