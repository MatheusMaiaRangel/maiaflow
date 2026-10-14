using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MaiaFlow.Tests.Integration
{
    /// <summary>Small helpers so tests read as a story: register, sign in, call the API.</summary>
    public static class TestClient
    {
        public const string Password = "senha-segura-1";

        public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public static string UniqueEmail() => $"user-{Guid.NewGuid():N}@example.com";

        public static async Task<HttpClient> SignedInClientAsync(ApiFixture fixture, string? email = null)
        {
            var client = fixture.Factory.CreateClient();
            email ??= UniqueEmail();

            var signUp = await client.PostAsJsonAsync("/api/users", new { name = "Usuário Teste", email, password = Password });
            signUp.EnsureSuccessStatusCode();

            return await SignInAsync(fixture, email, Password);
        }

        public static async Task<HttpClient> SignInAsync(ApiFixture fixture, string email, string password)
        {
            var client = fixture.Factory.CreateClient();
            var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
            login.EnsureSuccessStatusCode();

            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        public static Task<HttpResponseMessage> PatchJsonAsync(this HttpClient client, string url, string json) =>
            client.PatchAsync(url, new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient client, string url, string json) =>
            client.PostAsync(url, new StringContent(json, System.Text.Encoding.UTF8, "application/json"));

        public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage response) =>
            await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
