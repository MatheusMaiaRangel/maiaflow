using System.Net;
using System.Net.Http.Json;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    [Collection(ApiCollection.Name)]
    public class ApiContractTests(ApiFixture fixture)
    {
        [Fact]
        public async Task Routes_without_the_api_prefix_do_not_exist()
        {
            var client = await SignedInClientAsync(fixture);

            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/tasks")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/habits")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/tasks")).StatusCode);
        }

        [Fact]
        public async Task Requests_without_a_token_get_401()
        {
            var response = await fixture.Factory.CreateClient().GetAsync("/api/tasks");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Create_task_returns_201_with_location_and_enum_as_string()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PostJsonAsync("/api/tasks", """{"title":"Pagar a conta"}""");

            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var body = await response.ReadJsonAsync();
            Assert.Equal("Pending", body.GetProperty("status").GetString());
            Assert.EndsWith($"/api/tasks/{body.GetProperty("id").GetInt32()}", response.Headers.Location!.AbsolutePath);
        }

        [Fact]
        public async Task Delete_task_returns_204_and_a_second_delete_returns_404()
        {
            var client = await SignedInClientAsync(fixture);
            var created = await (await client.PostJsonAsync("/api/tasks", """{"title":"Apagar"}""")).ReadJsonAsync();
            var url = $"/api/tasks/{created.GetProperty("id").GetInt32()}";

            Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(url)).StatusCode);
        }

        [Fact]
        public async Task Domain_validation_errors_return_400_problem_details_not_500()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.PostJsonAsync("/api/habits",
                """{"title":"Treinar","startDate":"2026-10-12T00:00:00","frequencyType":"SpecificDaysOfWeek","daysOfWeek":0}""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            var problem = await response.ReadJsonAsync();
            Assert.Equal(400, problem.GetProperty("status").GetInt32());
            Assert.Contains("dia da semana", problem.GetProperty("detail").GetString());
        }

        [Fact]
        public async Task Unknown_resources_return_404_problem_details()
        {
            var client = await SignedInClientAsync(fixture);

            var response = await client.GetAsync("/api/tasks/999999");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(404, (await response.ReadJsonAsync()).GetProperty("status").GetInt32());
        }

        [Fact]
        public async Task Duplicated_email_returns_409()
        {
            var email = UniqueEmail();
            var client = fixture.Factory.CreateClient();
            var body = new { name = "Maria Silva", email, password = Password };
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/users", body)).StatusCode);

            var second = await client.PostAsJsonAsync("/api/users", body);

            Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        }

        [Fact]
        public async Task Wrong_credentials_return_401_with_the_same_message_for_unknown_email_and_wrong_password()
        {
            var email = UniqueEmail();
            var client = fixture.Factory.CreateClient();
            await client.PostAsJsonAsync("/api/users", new { name = "Maria Silva", email, password = Password });

            var wrongPassword = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "errada-123" });
            var unknownEmail = await client.PostAsJsonAsync("/api/auth/login", new { email = UniqueEmail(), password = Password });

            Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
            Assert.Equal((await wrongPassword.ReadJsonAsync()).GetProperty("detail").GetString(),
                (await unknownEmail.ReadJsonAsync()).GetProperty("detail").GetString());
        }

        [Fact]
        public async Task Cors_allows_only_the_configured_origin()
        {
            var client = fixture.Factory.CreateClient();

            var allowed = new HttpRequestMessage(HttpMethod.Options, "/api/tasks");
            allowed.Headers.Add("Origin", "http://localhost:3000");
            allowed.Headers.Add("Access-Control-Request-Method", "POST");
            var denied = new HttpRequestMessage(HttpMethod.Options, "/api/tasks");
            denied.Headers.Add("Origin", "http://evil.example");
            denied.Headers.Add("Access-Control-Request-Method", "POST");

            Assert.True((await client.SendAsync(allowed)).Headers.Contains("Access-Control-Allow-Origin"));
            Assert.False((await client.SendAsync(denied)).Headers.Contains("Access-Control-Allow-Origin"));
        }

        [Fact]
        public async Task Swagger_document_lists_enums_as_strings_and_only_api_routes()
        {
            var json = await (await fixture.Factory.CreateClient().GetAsync("/swagger/v1/swagger.json")).ReadJsonAsync();

            var paths = json.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
            Assert.All(paths, p => Assert.StartsWith("/api/", p));
            var status = json.GetProperty("components").GetProperty("schemas").GetProperty("TaskItemStatus");
            Assert.Equal("string", status.GetProperty("type").GetString());
        }

        [Fact]
        public async Task Every_operation_documents_a_success_response_so_clients_can_be_generated()
        {
            var json = await (await fixture.Factory.CreateClient().GetAsync("/swagger/v1/swagger.json")).ReadJsonAsync();

            foreach (var path in json.GetProperty("paths").EnumerateObject())
            foreach (var operation in path.Value.EnumerateObject())
            {
                var success = operation.Value.GetProperty("responses").EnumerateObject()
                    .Where(r => r.Name.StartsWith('2')).ToList();
                Assert.True(success.Count > 0, $"{operation.Name.ToUpper()} {path.Name} has no 2xx response");
                foreach (var response in success.Where(r => r.Name != "204"))
                {
                    Assert.True(response.Value.TryGetProperty("content", out var content)
                                && content.GetProperty("application/json").TryGetProperty("schema", out _),
                        $"{operation.Name.ToUpper()} {path.Name} {response.Name} has no schema");
                }
            }
        }

        [Fact]
        public async Task Patch_fields_that_can_be_cleared_are_documented_as_nullable()
        {
            var json = await (await fixture.Factory.CreateClient().GetAsync("/swagger/v1/swagger.json")).ReadJsonAsync();
            var schemas = json.GetProperty("components").GetProperty("schemas");

            foreach (var (schema, property) in new[]
                     { ("UpdateTaskDTO", "description"), ("UpdateTaskDTO", "dueDate"), ("UpdateHabitDetailsDTO", "description") })
            {
                var field = schemas.GetProperty(schema).GetProperty("properties").GetProperty(property);
                Assert.True(field.TryGetProperty("nullable", out var nullable) && nullable.GetBoolean(),
                    $"{schema}.{property} should be nullable");
            }
        }

        [Fact]
        public async Task A_valid_token_of_a_deleted_user_gets_401_instead_of_a_server_error()
        {
            var client = await SignedInClientAsync(fixture);
            await client.DeleteAsync("/api/users/me");

            var response = await client.PostJsonAsync("/api/tasks", """{"title":"Órfã"}""");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task A_login_with_an_absurdly_long_email_is_rejected_like_any_wrong_credential()
        {
            var response = await fixture.Factory.CreateClient().PostAsJsonAsync("/api/auth/login",
                new { email = new string('a', 5000) + "@example.com", password = Password });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Sign_up_rejects_oversized_fields_before_hashing()
        {
            var response = await fixture.Factory.CreateClient().PostAsJsonAsync("/api/users",
                new { name = "Maria Silva", email = new string('a', 5000) + "@example.com", password = Password });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Undefined_enum_numbers_are_rejected()
        {
            var client = await SignedInClientAsync(fixture);
            var task = await (await client.PostJsonAsync("/api/tasks", """{"title":"Tarefa"}""")).ReadJsonAsync();

            var response = await client.PatchJsonAsync($"/api/tasks/{task.GetProperty("id").GetInt32()}/status", """{"status":99}""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
}
