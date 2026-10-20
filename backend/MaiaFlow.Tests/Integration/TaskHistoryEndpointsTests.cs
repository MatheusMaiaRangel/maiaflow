using System.Net;
using System.Text.Json;
using MaiaFlow.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    /// <summary><c>createdOn</c> and <c>completedOn</c> on tasks (D25): Brasília days, set by the server.</summary>
    [Collection(ApiCollection.Name)]
    public class TaskHistoryEndpointsTests(ApiFixture fixture)
    {
        private static readonly DateTime Today = new(2026, 10, 17);

        private (WebApplicationFactory<Program> Factory, FakeTimeProvider Clock) FactoryAt(DateTimeOffset instant)
        {
            var clock = new FakeTimeProvider(instant);
            clock.SetLocalTimeZone(BrazilTime.Zone);
            var factory = fixture.Factory.WithWebHostBuilder(b =>
                b.ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));
            return (factory, clock);
        }

        // 12:00 in Brasília (UTC-3, no daylight saving), so "today" is unambiguous.
        private (WebApplicationFactory<Program> Factory, FakeTimeProvider Clock) FactoryAtNoon() =>
            FactoryAt(new DateTimeOffset(Today.AddHours(15), TimeSpan.Zero));

        private static async Task<(JsonElement Body, string Url)> CreateAsync(HttpClient client, string title = "Tarefa")
        {
            var body = await (await client.PostJsonAsync("/api/tasks", $$"""{"title":"{{title}}"}""")).ReadJsonAsync();
            return (body, $"/api/tasks/{body.GetProperty("id").GetInt32()}");
        }

        private static async Task<JsonElement> SetStatusAsync(HttpClient client, string url, string status)
        {
            var response = await client.PatchJsonAsync($"{url}/status", $$"""{"status":"{{status}}"}""");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.ReadJsonAsync();
        }

        private static string? Day(JsonElement body, string property) =>
            body.GetProperty(property).ValueKind == JsonValueKind.Null ? null : body.GetProperty(property).GetString();

        [Fact]
        public async Task A_new_task_has_the_day_it_was_created_and_no_completion_day()
        {
            var (factory, _) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);

            var (body, url) = await CreateAsync(client);
            var read = await (await client.GetAsync(url)).ReadJsonAsync();

            Assert.Equal("2026-10-17", Day(body, "createdOn"));
            Assert.Null(Day(body, "completedOn"));
            Assert.Equal("2026-10-17", Day(read, "createdOn"));
            Assert.Null(Day(read, "completedOn"));
        }

        [Fact]
        public async Task The_creation_day_is_the_brasilia_day_late_in_the_evening()
        {
            // 23:30 in Brasília is already the next day in UTC.
            var (factory, _) = FactoryAt(new DateTimeOffset(Today.AddDays(1).AddHours(2).AddMinutes(30), TimeSpan.Zero));
            var client = await SignedInClientAsync(factory);

            var (body, _) = await CreateAsync(client);

            Assert.Equal("2026-10-17", Day(body, "createdOn"));
        }

        [Fact]
        public async Task Completing_sets_the_completion_day_and_completing_again_keeps_it()
        {
            var (factory, clock) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);
            var (_, url) = await CreateAsync(client);

            clock.Advance(TimeSpan.FromDays(2));
            var completed = await SetStatusAsync(client, url, "Completed");
            clock.Advance(TimeSpan.FromDays(1));
            var again = await SetStatusAsync(client, url, "Completed");

            Assert.Equal("2026-10-19", Day(completed, "completedOn"));
            Assert.Equal("2026-10-19", Day(again, "completedOn"));
            Assert.Equal("2026-10-17", Day(again, "createdOn"));
        }

        [Theory]
        [InlineData("Pending")]
        [InlineData("NotCompleted")]
        public async Task Leaving_completed_clears_the_completion_day(string status)
        {
            var (factory, _) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);
            var (_, url) = await CreateAsync(client);
            await SetStatusAsync(client, url, "Completed");

            var reopened = await SetStatusAsync(client, url, status);
            var list = await (await client.GetAsync("/api/tasks")).ReadJsonAsync();

            Assert.Equal(status, reopened.GetProperty("status").GetString());
            Assert.Null(Day(reopened, "completedOn"));
            Assert.Null(Day(list[0], "completedOn"));
            Assert.Equal("2026-10-17", Day(reopened, "createdOn"));
        }

        [Fact]
        public async Task Editing_a_task_does_not_change_its_days()
        {
            var (factory, clock) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);
            var (_, url) = await CreateAsync(client);
            await SetStatusAsync(client, url, "Completed");

            clock.Advance(TimeSpan.FromDays(5));
            var edited = await (await client.PatchJsonAsync(url, """{"title":"Outro título"}""")).ReadJsonAsync();

            Assert.Equal("2026-10-17", Day(edited, "createdOn"));
            Assert.Equal("2026-10-17", Day(edited, "completedOn"));
        }

        [Fact]
        public async Task Tasks_that_existed_before_the_migration_keep_both_days_empty()
        {
            var (factory, _) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);
            var (_, url) = await CreateAsync(client, "Antiga");
            var id = int.Parse(url[(url.LastIndexOf('/') + 1)..]);
            await SimulateLegacyRowAsync(factory, id);

            var read = await (await client.GetAsync(url)).ReadJsonAsync();
            var completed = await SetStatusAsync(client, url, "Completed");

            Assert.Null(Day(read, "createdOn"));
            Assert.Null(Day(read, "completedOn"));
            Assert.Equal("Completed", read.GetProperty("status").GetString());
            Assert.Null(Day(completed, "createdOn"));
            Assert.Null(Day(completed, "completedOn"));
        }

        [Fact]
        public async Task A_legacy_task_completed_again_after_reopening_gets_a_completion_day()
        {
            var (factory, _) = FactoryAtNoon();
            var client = await SignedInClientAsync(factory);
            var (_, url) = await CreateAsync(client, "Antiga");
            await SimulateLegacyRowAsync(factory, int.Parse(url[(url.LastIndexOf('/') + 1)..]));

            await SetStatusAsync(client, url, "Pending");
            var completed = await SetStatusAsync(client, url, "Completed");

            Assert.Equal("2026-10-17", Day(completed, "completedOn"));
            Assert.Null(Day(completed, "createdOn"));
        }

        // A row as the migration leaves it: completed before the columns existed, so both are NULL.
        private static async Task SimulateLegacyRowAsync(WebApplicationFactory<Program> factory, int id)
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.ExecuteSqlAsync(
                $"""UPDATE tasks SET "CreatedOn" = NULL, "CompletedOn" = NULL, "Status" = 'Completed' WHERE "Id" = {id}""");
        }
    }
}
