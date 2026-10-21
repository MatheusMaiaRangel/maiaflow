using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MaiaFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    /// <summary>The stored dashboard (D28): one per user, saved whole, with a revision that catches stale devices.</summary>
    [Collection(ApiCollection.Name)]
    public class DashboardEndpointsTests(ApiFixture fixture)
    {
        private const string Url = "/api/dashboard";

        private static string Config(string title = "Concluídas") => $$$"""
            {"version":1,"sections":[{"id":"tasks","title":"Tarefas","widgets":[
              {"id":"done","title":"{{{title}}}","chart":"bar","grouping":"day",
               "series":[{"metric":{"variable":"tasks.completed"},"label":"Feitas","color":"blue"}],
               "period":{"kind":"last","days":30},"habitFilter":{"kind":"all"},"layout":{"x":0,"y":0,"w":2,"h":1}}]}]}
            """;

        private static Task<HttpResponseMessage> PutAsync(HttpClient client, int revision, string config) =>
            client.PutJsonAsync(Url, $$"""{"revision":{{revision}},"config":{{config}}}""");

        private static async Task<JsonElement> SaveAsync(HttpClient client, int revision, string config)
        {
            var response = await PutAsync(client, revision, config);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.ReadJsonAsync();
        }

        private static async Task<JsonElement> GetAsync(HttpClient client)
        {
            var response = await client.GetAsync(Url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await response.ReadJsonAsync();
        }

        private static void AssertSameJson(string expected, JsonElement actual) =>
            Assert.True(JsonNode.DeepEquals(JsonNode.Parse(expected), JsonNode.Parse(actual.GetRawText())),
                $"Expected {expected}\nbut got {actual.GetRawText()}");

        [Fact]
        public async Task Requests_without_a_token_get_401()
        {
            var client = fixture.Factory.CreateClient();

            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Url)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await PutAsync(client, 0, Config())).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync(Url)).StatusCode);
        }

        [Fact]
        public async Task A_user_who_never_saved_gets_revision_0_and_no_config()
        {
            var client = await SignedInClientAsync(fixture);

            var dashboard = await GetAsync(client);

            Assert.Equal(0, dashboard.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.Null, dashboard.GetProperty("config").ValueKind);
        }

        [Fact]
        public async Task A_saved_dashboard_reads_back_without_nulls_unknown_properties_or_fields_of_other_kinds()
        {
            var client = await SignedInClientAsync(fixture);
            const string sent = """
                {"version":1,"extra":"x","sections":[{"id":"s1","title":"Seção","widgets":[
                  {"id":"w1","title":"Taxa","chart":"line","grouping":"week","stacked":null,"background":null,"color":"red",
                   "series":[{"metric":{"variable":"habits.completed","divideBy":"habits.scheduled"},"label":"Feitos",
                              "color":"#A1b2C3","mark":null,"secret":true}],
                   "period":{"kind":"last","days":90,"from":"2026-01-01"},"habitFilter":{"kind":"all","habitId":7},
                   "layout":{"x":1,"y":2,"w":3,"h":4,"z":9}},
                  {"id":"w2","title":"Mês","chart":"area","grouping":"day","stacked":true,"background":"violet",
                   "series":[{"metric":{"variable":"tasks.created","divideBy":null},"label":"Criadas","color":"done","mark":"bar"}],
                   "period":{"kind":"custom","from":"2026-10-01","to":"2026-10-31","days":7},
                   "habitFilter":{"kind":"habit","habitId":3},"layout":{"x":0,"y":0,"w":1,"h":1}}]}]}
                """;
            const string expected = """
                {"version":1,"sections":[{"id":"s1","title":"Seção","widgets":[
                  {"id":"w1","title":"Taxa","chart":"line","grouping":"week",
                   "series":[{"metric":{"variable":"habits.completed","divideBy":"habits.scheduled"},"label":"Feitos","color":"#A1b2C3"}],
                   "period":{"kind":"last","days":90},"habitFilter":{"kind":"all"},"layout":{"x":1,"y":2,"w":3,"h":4}},
                  {"id":"w2","title":"Mês","chart":"area","grouping":"day","stacked":true,"background":"violet",
                   "series":[{"metric":{"variable":"tasks.created"},"label":"Criadas","color":"done","mark":"bar"}],
                   "period":{"kind":"custom","from":"2026-10-01","to":"2026-10-31"},
                   "habitFilter":{"kind":"habit","habitId":3},"layout":{"x":0,"y":0,"w":1,"h":1}}]}]}
                """;

            var saved = await SaveAsync(client, 0, sent);
            var read = await GetAsync(client);

            Assert.Equal(1, saved.GetProperty("revision").GetInt32());
            AssertSameJson(expected, saved.GetProperty("config"));
            Assert.Equal(1, read.GetProperty("revision").GetInt32());
            AssertSameJson(expected, read.GetProperty("config"));
        }

        [Fact]
        public async Task Every_save_moves_the_revision_forward()
        {
            var client = await SignedInClientAsync(fixture);

            var first = await SaveAsync(client, 0, Config("Um"));
            var second = await SaveAsync(client, 1, Config("Dois"));
            var read = await GetAsync(client);

            Assert.Equal(1, first.GetProperty("revision").GetInt32());
            Assert.Equal(2, second.GetProperty("revision").GetInt32());
            Assert.Equal(2, read.GetProperty("revision").GetInt32());
            Assert.Equal("Dois", read.GetProperty("config").GetProperty("sections")[0].GetProperty("widgets")[0]
                .GetProperty("title").GetString());
        }

        [Fact]
        public async Task Saving_over_a_revision_another_device_replaced_gets_409_and_changes_nothing()
        {
            var phone = await SignedInClientAsync(fixture);
            await SaveAsync(phone, 0, Config("Original"));
            await SaveAsync(phone, 1, Config("Do celular"));

            var stale = await PutAsync(phone, 1, Config("Do notebook"));

            Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
            Assert.Equal("application/problem+json", stale.Content.Headers.ContentType?.MediaType);
            Assert.Equal(DashboardService.ConflictMessage, (await stale.ReadJsonAsync()).GetProperty("detail").GetString());
            var read = await GetAsync(phone);
            Assert.Equal(2, read.GetProperty("revision").GetInt32());
            Assert.Contains("Do celular", read.GetProperty("config").GetRawText());
        }

        [Fact]
        public async Task Creating_again_with_revision_0_when_a_dashboard_exists_gets_409()
        {
            var client = await SignedInClientAsync(fixture);
            await SaveAsync(client, 0, Config());

            Assert.Equal(HttpStatusCode.Conflict, (await PutAsync(client, 0, Config())).StatusCode);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(-1)]
        public async Task A_revision_that_never_existed_gets_409(int revision)
        {
            var client = await SignedInClientAsync(fixture);

            Assert.Equal(HttpStatusCode.Conflict, (await PutAsync(client, revision, Config())).StatusCode);
            Assert.Equal(0, (await GetAsync(client)).GetProperty("revision").GetInt32());
        }

        [Fact]
        public async Task Restoring_the_default_clears_the_config_and_bumps_the_revision()
        {
            var client = await SignedInClientAsync(fixture);
            await SaveAsync(client, 0, Config());

            var deleted = await client.DeleteAsync(Url);
            var read = await GetAsync(client);

            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            Assert.Equal(2, read.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.Null, read.GetProperty("config").ValueKind);
        }

        [Fact]
        public async Task A_device_holding_the_revision_from_before_the_restore_gets_409()
        {
            var client = await SignedInClientAsync(fixture);
            await SaveAsync(client, 0, Config());
            await client.DeleteAsync(Url);

            var stale = await PutAsync(client, 1, Config("Antigo"));
            var fresh = await SaveAsync(client, 2, Config("Novo"));

            Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
            Assert.Equal(3, fresh.GetProperty("revision").GetInt32());
        }

        [Fact]
        public async Task Restoring_without_a_saved_dashboard_does_nothing()
        {
            var client = await SignedInClientAsync(fixture);

            var deleted = await client.DeleteAsync(Url);
            var read = await GetAsync(client);

            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            Assert.Equal(0, read.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.Null, read.GetProperty("config").ValueKind);
            Assert.Equal(1, (await SaveAsync(client, 0, Config())).GetProperty("revision").GetInt32());
        }

        [Fact]
        public async Task A_user_never_sees_or_changes_another_users_dashboard()
        {
            var owner = await SignedInClientAsync(fixture);
            var intruder = await SignedInClientAsync(fixture);
            await SaveAsync(owner, 0, Config("Do dono"));

            var seen = await GetAsync(intruder);
            var overwrite = await PutAsync(intruder, 1, Config("Hackeado"));
            var own = await SaveAsync(intruder, 0, Config("Do outro"));
            await intruder.DeleteAsync(Url);

            Assert.Equal(0, seen.GetProperty("revision").GetInt32());
            Assert.Equal(JsonValueKind.Null, seen.GetProperty("config").ValueKind);
            Assert.Equal(HttpStatusCode.Conflict, overwrite.StatusCode);
            Assert.Equal(1, own.GetProperty("revision").GetInt32());
            var untouched = await GetAsync(owner);
            Assert.Equal(1, untouched.GetProperty("revision").GetInt32());
            Assert.Contains("Do dono", untouched.GetProperty("config").GetRawText());
        }

        [Fact]
        public async Task Deleting_the_user_deletes_the_dashboard()
        {
            var email = UniqueEmail();
            var client = await SignedInClientAsync(fixture, email);
            await SaveAsync(client, 0, Config());
            using var scope = fixture.Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userId = await db.users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();
            Assert.Equal(1, await db.dashboards.CountAsync(d => d.UserId == userId));

            await client.DeleteAsync("/api/users/me");

            Assert.Equal(0, await db.dashboards.CountAsync(d => d.UserId == userId));
        }

        [Fact]
        public async Task A_valid_token_of_a_deleted_user_gets_401_when_saving()
        {
            var client = await SignedInClientAsync(fixture);
            await client.DeleteAsync("/api/users/me");

            Assert.Equal(HttpStatusCode.Unauthorized, (await PutAsync(client, 0, Config())).StatusCode);
        }

        [Fact]
        public async Task An_invalid_dashboard_gets_400_listing_the_problems_in_portuguese()
        {
            var client = await SignedInClientAsync(fixture);
            var config = Config().Replace("\"days\":30", "\"days\":14").Replace("\"w\":2", "\"w\":5");

            var response = await PutAsync(client, 0, config);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            var detail = (await response.ReadJsonAsync()).GetProperty("detail").GetString();
            Assert.Contains("Escolha 7, 30 ou 90 dias.", detail);
            Assert.Contains("Posição ou tamanho inválido.", detail);
            Assert.Equal(0, (await GetAsync(client)).GetProperty("revision").GetInt32());
        }

        [Theory]
        [InlineData("""{"revision":0,"config":""")]
        [InlineData("""{"revision":"0","config":CONFIG}""")]
        [InlineData("""{"revision":1.5,"config":CONFIG}""")]
        [InlineData("""{"config":CONFIG}""")]
        [InlineData("""{"revision":0}""")]
        [InlineData("""{"revision":0,"config":null}""")]
        [InlineData("""{"revision":0,"config":[]}""")]
        [InlineData("""[]""")]
        [InlineData("""{"revision":99999999999,"config":CONFIG}""")]
        public async Task Malformed_bodies_get_400_not_500(string body)
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PutJsonAsync(Url, body.Replace("CONFIG", Config()));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task A_body_over_64_kb_gets_413()
        {
            // The limit is Kestrel's (Program.MaxRequestBodyBytes); the in-memory test server has none, so this
            // test runs the API on a real Kestrel port.
            using var factory = fixture.Factory.WithWebHostBuilder(_ => { });
            factory.UseKestrel(0);
            factory.StartServer();
            var client = await SignedInClientAsync(factory);
            var padding = new string('a', 64 * 1024);

            var tooLarge = await client.PutJsonAsync(Url, $$"""{"revision":0,"padding":"{{padding}}","config":{{Config()}}}""");
            var normal = await PutAsync(client, 0, Config());

            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, tooLarge.StatusCode);
            Assert.Equal(HttpStatusCode.OK, normal.StatusCode);
        }

        [Fact]
        public async Task Of_concurrent_saves_over_the_same_revision_exactly_one_wins()
        {
            var client = await SignedInClientAsync(fixture);
            await SaveAsync(client, 0, Config());

            var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => PutAsync(client, 1, Config($"Aparelho {i}"))));

            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
            Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.OK),
                r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
            Assert.Equal(2, (await GetAsync(client)).GetProperty("revision").GetInt32());
        }

        [Fact]
        public async Task Of_concurrent_first_saves_exactly_one_wins()
        {
            var client = await SignedInClientAsync(fixture);

            var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => PutAsync(client, 0, Config($"Aparelho {i}"))));

            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
            Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.OK),
                r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
            Assert.Equal(1, (await GetAsync(client)).GetProperty("revision").GetInt32());
        }

        [Fact]
        public async Task The_openapi_document_marks_optional_fields_optional_and_the_config_nullable()
        {
            var json = await (await fixture.Factory.CreateClient().GetAsync("/swagger/v1/swagger.json")).ReadJsonAsync();
            var schemas = json.GetProperty("components").GetProperty("schemas");

            string[] Required(string name) =>
                schemas.GetProperty(name).GetProperty("required").EnumerateArray().Select(r => r.GetString()!).ToArray();

            Assert.Equivalent(new[] { "revision", "config" }, Required("DashboardDTO"));
            Assert.True(schemas.GetProperty("DashboardDTO").GetProperty("properties").GetProperty("config")
                .GetProperty("nullable").GetBoolean());
            Assert.Equivalent(new[] { "revision", "config" }, Required("SaveDashboardDTO"));
            Assert.Equivalent(new[] { "version", "sections" }, Required("DashboardConfigDTO"));
            Assert.Equivalent(new[] { "x", "y", "w", "h" }, Required("DashboardLayoutDTO"));
            Assert.Equivalent(new[] { "id", "title", "chart", "series", "grouping", "period", "habitFilter", "layout" },
                Required("DashboardWidgetDTO"));
            Assert.Equivalent(new[] { "metric", "label", "color" }, Required("DashboardSeriesDTO"));
            Assert.Equivalent(new[] { "variable" }, Required("DashboardMetricDTO"));
            Assert.Equivalent(new[] { "kind" }, Required("DashboardPeriodDTO"));
            Assert.Equivalent(new[] { "kind" }, Required("DashboardHabitFilterDTO"));
        }
    }
}
