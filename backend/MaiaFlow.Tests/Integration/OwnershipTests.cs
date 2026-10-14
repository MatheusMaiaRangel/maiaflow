using System.Net;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    /// <summary>One user must never see or change another user's tasks and habits.</summary>
    [Collection(ApiCollection.Name)]
    public class OwnershipTests(ApiFixture fixture)
    {
        [Fact]
        public async Task A_user_cannot_read_update_or_delete_another_users_task()
        {
            var owner = await SignedInClientAsync(fixture);
            var intruder = await SignedInClientAsync(fixture);
            var created = await (await owner.PostJsonAsync("/api/tasks", """{"title":"Privada"}""")).ReadJsonAsync();
            var url = $"/api/tasks/{created.GetProperty("id").GetInt32()}";

            Assert.Equal(HttpStatusCode.NotFound, (await intruder.GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await intruder.PatchJsonAsync(url, """{"title":"Hackeada"}""")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await intruder.PatchJsonAsync($"{url}/status", """{"status":"Completed"}""")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync(url)).StatusCode);

            var untouched = await (await owner.GetAsync(url)).ReadJsonAsync();
            Assert.Equal("Privada", untouched.GetProperty("title").GetString());
        }

        [Fact]
        public async Task Task_lists_only_contain_the_callers_tasks()
        {
            var first = await SignedInClientAsync(fixture);
            var second = await SignedInClientAsync(fixture);
            await first.PostJsonAsync("/api/tasks", """{"title":"Da primeira"}""");

            var list = await (await second.GetAsync("/api/tasks")).ReadJsonAsync();

            Assert.Equal(0, list.GetArrayLength());
        }

        [Fact]
        public async Task A_user_cannot_read_update_or_delete_another_users_habit()
        {
            var owner = await SignedInClientAsync(fixture);
            var intruder = await SignedInClientAsync(fixture);
            var created = await (await owner.PostJsonAsync("/api/habits", DailyHabit("Privado"))).ReadJsonAsync();
            var url = $"/api/habits/{created.GetProperty("id").GetInt32()}";

            Assert.Equal(HttpStatusCode.NotFound, (await intruder.GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await intruder.PatchJsonAsync(url, """{"title":"Hackeado"}""")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,
                (await intruder.PatchJsonAsync($"{url}/recurrence", """{"frequencyType":"Daily"}""")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await intruder.DeleteAsync(url)).StatusCode);
        }

        [Fact]
        public async Task A_user_cannot_change_the_status_of_another_users_occurrence()
        {
            var owner = await SignedInClientAsync(fixture);
            var intruder = await SignedInClientAsync(fixture);
            var start = BrazilTime.Today.AddDays(-2);
            await owner.PostJsonAsync("/api/habits", DailyHabit("Privado", start));
            var calendar = await (await owner.GetAsync(CalendarUrl(start, BrazilTime.Today))).ReadJsonAsync();
            var occurrenceId = calendar[0].GetProperty("id").GetInt32();

            var response = await intruder.PatchJsonAsync(
                $"/api/habits/occurrences/{occurrenceId}/status", """{"status":"Completed"}""");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Calendars_only_contain_the_callers_occurrences()
        {
            var owner = await SignedInClientAsync(fixture);
            var other = await SignedInClientAsync(fixture);
            var start = BrazilTime.Today.AddDays(-2);
            await owner.PostJsonAsync("/api/habits", DailyHabit("Privado", start));

            var calendar = await (await other.GetAsync(CalendarUrl(start, BrazilTime.Today))).ReadJsonAsync();

            Assert.Equal(0, calendar.GetArrayLength());
        }

        public static string DailyHabit(string title, DateTime? start = null) =>
            $$"""{"title":"{{title}}","startDate":"{{(start ?? BrazilTime.Today):yyyy-MM-dd}}T00:00:00","frequencyType":"Daily","daysOfWeek":0}""";

        public static string CalendarUrl(DateTime start, DateTime end) =>
            $"/api/habits/calendar?start={start:yyyy-MM-dd}&end={end:yyyy-MM-dd}";
    }
}
