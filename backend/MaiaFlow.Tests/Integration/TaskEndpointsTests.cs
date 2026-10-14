using System.Net;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    [Collection(ApiCollection.Name)]
    public class TaskEndpointsTests(ApiFixture fixture)
    {
        private async Task<(HttpClient Client, string Url)> CreateTaskAsync(string json)
        {
            var client = await SignedInClientAsync(fixture);
            var created = await (await client.PostJsonAsync("/api/tasks", json)).ReadJsonAsync();
            return (client, $"/api/tasks/{created.GetProperty("id").GetInt32()}");
        }

        [Fact]
        public async Task Patch_with_null_clears_optional_fields()
        {
            var (client, url) = await CreateTaskAsync(
                """{"title":"Com tudo","description":"Detalhes","dueDate":"2026-12-31T00:00:00"}""");

            var response = await client.PatchJsonAsync(url, """{"description":null,"dueDate":null}""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.ReadJsonAsync();
            Assert.Equal(System.Text.Json.JsonValueKind.Null, body.GetProperty("description").ValueKind);
            Assert.Equal(System.Text.Json.JsonValueKind.Null, body.GetProperty("dueDate").ValueKind);
            Assert.Equal("Com tudo", body.GetProperty("title").GetString());
        }

        [Fact]
        public async Task Patch_without_a_field_keeps_its_value()
        {
            var (client, url) = await CreateTaskAsync(
                """{"title":"Com tudo","description":"Detalhes","dueDate":"2026-12-31T00:00:00"}""");

            var body = await (await client.PatchJsonAsync(url, """{"title":"Novo título"}""")).ReadJsonAsync();

            Assert.Equal("Novo título", body.GetProperty("title").GetString());
            Assert.Equal("Detalhes", body.GetProperty("description").GetString());
            Assert.StartsWith("2026-12-31", body.GetProperty("dueDate").GetString());
        }

        [Fact]
        public async Task Patch_with_values_replaces_the_optional_fields()
        {
            var (client, url) = await CreateTaskAsync("""{"title":"Simples"}""");

            var body = await (await client.PatchJsonAsync(url,
                """{"description":"Nova","dueDate":"2027-01-15T00:00:00"}""")).ReadJsonAsync();

            Assert.Equal("Nova", body.GetProperty("description").GetString());
            Assert.StartsWith("2027-01-15", body.GetProperty("dueDate").GetString());
        }

        [Fact]
        public async Task A_one_character_title_is_valid_on_create_and_on_update()
        {
            var client = await SignedInClientAsync(fixture);

            var created = await client.PostJsonAsync("/api/tasks", """{"title":"a"}""");
            var id = (await created.ReadJsonAsync()).GetProperty("id").GetInt32();
            var updated = await client.PatchJsonAsync($"/api/tasks/{id}", """{"title":"b"}""");

            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        }

        [Theory]
        [InlineData("""{"title":""}""")]
        [InlineData("""{"title":"   "}""")]
        [InlineData("""{}""")]
        public async Task Creating_a_task_without_a_usable_title_returns_400(string json)
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PostJsonAsync("/api/tasks", json);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task A_too_long_title_returns_400_instead_of_a_database_error()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PostJsonAsync("/api/tasks", $$"""{"title":"{{new string('a', 151)}}"}""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Status_can_be_changed_and_an_unknown_status_returns_400()
        {
            var (client, url) = await CreateTaskAsync("""{"title":"Tarefa"}""");

            var done = await client.PatchJsonAsync($"{url}/status", """{"status":"Completed"}""");
            var invalid = await client.PatchJsonAsync($"{url}/status", """{"status":"Banana"}""");
            var numeric = await client.PatchJsonAsync($"{url}/status", """{"status":2}""");

            Assert.Equal("Completed", (await done.ReadJsonAsync()).GetProperty("status").GetString());
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            Assert.Equal(HttpStatusCode.OK, numeric.StatusCode);
        }
    }
}
