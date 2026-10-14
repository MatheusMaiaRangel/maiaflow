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
    public class HabitEndpointsTests(ApiFixture fixture)
    {
        private static readonly DateTime Today = new(2026, 10, 14);

        private (WebApplicationFactory<Program> Factory, FakeTimeProvider Clock) FactoryAt(DateTime utcDay)
        {
            var clock = new FakeTimeProvider(new DateTimeOffset(utcDay, TimeSpan.Zero));
            var factory = fixture.Factory.WithWebHostBuilder(b =>
                b.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));
            return (factory, clock);
        }

        private static List<JsonElement> Items(JsonElement array) => array.EnumerateArray().ToList();

        private static string[] Dates(IEnumerable<JsonElement> items) =>
            items.Select(i => i.GetProperty("date").GetString()![..10]).ToArray();

        [Fact]
        public async Task Create_returns_201_and_the_recurrence_is_readable_back()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PostJsonAsync("/api/habits",
                """{"title":"Treinar","startDate":"2026-10-12T00:00:00","frequencyType":"SpecificDaysOfWeek","daysOfWeek":42}""");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.ReadJsonAsync();
            Assert.Equal("SpecificDaysOfWeek", body.GetProperty("currentFrequencyType").GetString());
            Assert.Equal(42, body.GetProperty("currentDaysOfWeek").GetInt32());
            Assert.StartsWith("2026-10-12", body.GetProperty("currentEffectiveFrom").GetString());
            Assert.EndsWith($"/api/habits/{body.GetProperty("id").GetInt32()}", response.Headers.Location!.AbsolutePath);
        }

        [Fact]
        public async Task Monthly_habits_keep_their_days_of_the_month()
        {
            var client = await SignedInClientAsync(fixture);

            var body = await (await client.PostJsonAsync("/api/habits",
                """{"title":"Pagar contas","startDate":"2026-10-01T00:00:00","frequencyType":"Monthly","daysOfWeek":0,"daysOfMonth":[1,15]}"""))
                .ReadJsonAsync();

            Assert.Equal([1, 15], body.GetProperty("currentDaysOfMonth").EnumerateArray().Select(d => d.GetInt32()));
        }

        [Fact]
        public async Task Invalid_week_day_masks_and_unknown_frequencies_return_400()
        {
            var client = await SignedInClientAsync(fixture);

            var badMask = await client.PostJsonAsync("/api/habits",
                """{"title":"Treinar","startDate":"2026-10-12T00:00:00","frequencyType":"Daily","daysOfWeek":999}""");
            var badFrequency = await client.PostJsonAsync("/api/habits",
                """{"title":"Treinar","startDate":"2026-10-12T00:00:00","frequencyType":"Hourly","daysOfWeek":0}""");

            Assert.Equal(HttpStatusCode.BadRequest, badMask.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, badFrequency.StatusCode);
        }

        [Fact]
        public async Task Patch_can_clear_the_description_and_keep_the_title()
        {
            var client = await SignedInClientAsync(fixture);
            var created = await (await client.PostJsonAsync("/api/habits",
                """{"title":"Treinar","description":"Academia","startDate":"2026-10-12T00:00:00","frequencyType":"Daily","daysOfWeek":0}"""))
                .ReadJsonAsync();
            var url = $"/api/habits/{created.GetProperty("id").GetInt32()}";

            var cleared = await (await client.PatchJsonAsync(url, """{"description":null}""")).ReadJsonAsync();
            var kept = await (await client.PatchJsonAsync(url, """{"title":"Correr"}""")).ReadJsonAsync();

            Assert.Equal(JsonValueKind.Null, cleared.GetProperty("description").ValueKind);
            Assert.Equal("Treinar", cleared.GetProperty("title").GetString());
            Assert.Equal("Correr", kept.GetProperty("title").GetString());
        }

        [Fact]
        public async Task Delete_returns_204_and_removes_the_habit()
        {
            var client = await SignedInClientAsync(fixture);
            var created = await (await client.PostJsonAsync("/api/habits", DailyHabit("Apagar"))).ReadJsonAsync();
            var url = $"/api/habits/{created.GetProperty("id").GetInt32()}";

            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(url)).StatusCode);
        }

        [Fact]
        public async Task Past_days_are_stored_with_real_ids_and_future_days_are_calculated_with_id_zero()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            await client.PostJsonAsync("/api/habits", DailyHabit("Diário", Today.AddDays(-2)));

            var calendar = Items(await (await client.GetAsync(CalendarUrl(Today.AddDays(-2), Today.AddDays(2)))).ReadJsonAsync());

            Assert.Equal(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"], Dates(calendar));
            Assert.All(calendar.Take(3), o => Assert.True(o.GetProperty("id").GetInt32() > 0));
            Assert.All(calendar.Skip(3), o => Assert.Equal(0, o.GetProperty("id").GetInt32()));
            Assert.All(calendar, o => Assert.Equal("Pending", o.GetProperty("status").GetString()));
        }

        [Fact]
        public async Task Future_days_before_the_requested_start_are_not_returned()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            await client.PostJsonAsync("/api/habits", DailyHabit("Diário", Today));

            var calendar = Items(await (await client.GetAsync(CalendarUrl(Today.AddDays(5), Today.AddDays(6)))).ReadJsonAsync());

            Assert.Equal(["2026-10-19", "2026-10-20"], Dates(calendar));
        }

        [Fact]
        public async Task A_future_occurrence_has_no_id_so_its_status_cannot_be_updated()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            await client.PostJsonAsync("/api/habits", DailyHabit("Diário", Today));
            var future = Items(await (await client.GetAsync(CalendarUrl(Today.AddDays(1), Today.AddDays(1)))).ReadJsonAsync())[0];

            var response = await client.PatchJsonAsync(
                $"/api/habits/occurrences/{future.GetProperty("id").GetInt32()}/status", """{"status":"Completed"}""");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task An_occurrence_can_be_completed_and_set_back_to_pending()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            await client.PostJsonAsync("/api/habits", DailyHabit("Diário", Today));
            var occurrence = Items(await (await client.GetAsync(CalendarUrl(Today, Today))).ReadJsonAsync())[0];
            var url = $"/api/habits/occurrences/{occurrence.GetProperty("id").GetInt32()}/status";

            var completed = await (await client.PatchJsonAsync(url, """{"status":"Completed"}""")).ReadJsonAsync();
            var afterReload = Items(await (await client.GetAsync(CalendarUrl(Today, Today))).ReadJsonAsync())[0];
            var pending = await (await client.PatchJsonAsync(url, """{"status":"Pending"}""")).ReadJsonAsync();

            Assert.Equal("Completed", completed.GetProperty("status").GetString());
            Assert.Equal("Completed", afterReload.GetProperty("status").GetString());
            Assert.Equal("Pending", pending.GetProperty("status").GetString());
        }

        [Fact]
        public async Task Repeated_and_concurrent_calendar_requests_never_duplicate_occurrences()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            await client.PostJsonAsync("/api/habits", DailyHabit("Diário", Today.AddDays(-9)));
            var url = CalendarUrl(Today.AddDays(-9), Today);

            var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => client.GetAsync(url)));
            var again = Items(await (await client.GetAsync(url)).ReadJsonAsync());

            Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
            Assert.Equal(10, again.Count);
            Assert.Equal(10, Dates(again).Distinct().Count());
        }

        [Fact]
        public async Task Changing_the_recurrence_keeps_the_past_and_applies_the_new_rule_from_the_given_date()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            var created = await (await client.PostJsonAsync("/api/habits", DailyHabit("Treinar", Today.AddDays(-3)))).ReadJsonAsync();
            var id = created.GetProperty("id").GetInt32();
            await client.GetAsync(CalendarUrl(Today.AddDays(-3), Today)); // generates the past days

            // Mondays-only from next Monday (2026-10-19) on.
            var changed = await client.PatchJsonAsync($"/api/habits/{id}/recurrence",
                """{"frequencyType":"SpecificDaysOfWeek","daysOfWeek":2,"effectiveFrom":"2026-10-19T00:00:00"}""");
            var calendar = Items(await (await client.GetAsync(CalendarUrl(Today.AddDays(-3), Today.AddDays(14)))).ReadJsonAsync());

            Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
            Assert.Equal("SpecificDaysOfWeek", (await changed.ReadJsonAsync()).GetProperty("currentFrequencyType").GetString());
            // Daily until 2026-10-18 (inclusive), then only Mondays: 19 and 26 (Oct 28 is outside the range).
            Assert.Equal(
                ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
                 "2026-10-19", "2026-10-26"],
                Dates(calendar));
        }

        [Fact]
        public async Task A_rule_scheduled_for_the_future_does_not_hide_the_days_before_it()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            var created = await (await client.PostJsonAsync("/api/habits", DailyHabit("Treinar", Today))).ReadJsonAsync();
            await client.PatchJsonAsync($"/api/habits/{created.GetProperty("id").GetInt32()}/recurrence",
                """{"frequencyType":"Weekly","daysOfWeek":0,"effectiveFrom":"2026-10-20T00:00:00"}""");

            var calendar = Items(await (await client.GetAsync(CalendarUrl(Today, Today.AddDays(8)))).ReadJsonAsync());

            // Daily 14..19, then weekly anchored on Tuesday 2026-10-20 (the next one, 27th, is out of range).
            Assert.Equal(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"],
                Dates(calendar));
        }

        [Fact]
        public async Task Changing_the_recurrence_for_days_already_generated_returns_400()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            var created = await (await client.PostJsonAsync("/api/habits", DailyHabit("Treinar", Today.AddDays(-3)))).ReadJsonAsync();
            await client.GetAsync(CalendarUrl(Today.AddDays(-3), Today));

            var response = await client.PatchJsonAsync($"/api/habits/{created.GetProperty("id").GetInt32()}/recurrence",
                """{"frequencyType":"Weekly","daysOfWeek":0,"effectiveFrom":"2026-10-14T00:00:00"}""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Without_effectiveFrom_the_change_starts_on_the_first_day_that_is_not_generated_yet()
        {
            var (factory, _) = FactoryAt(Today);
            var client = await SignedInClientAsync(factory);
            var created = await (await client.PostJsonAsync("/api/habits", DailyHabit("Treinar", Today.AddDays(-3)))).ReadJsonAsync();
            await client.GetAsync(CalendarUrl(Today.AddDays(-3), Today)); // days up to today are now generated

            var changed = await (await client.PatchJsonAsync($"/api/habits/{created.GetProperty("id").GetInt32()}/recurrence",
                """{"frequencyType":"Weekly","daysOfWeek":0}""")).ReadJsonAsync();

            Assert.StartsWith("2026-10-15", changed.GetProperty("currentEffectiveFrom").GetString());
        }

        [Theory]
        [InlineData("")]
        [InlineData("?start=2026-10-10")]
        [InlineData("?start=2026-10-10&end=2026-10-01")]
        [InlineData("?start=2026-01-01&end=2027-12-31")]
        public async Task Invalid_calendar_ranges_return_400(string query)
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.GetAsync("/api/habits/calendar" + query);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
}
