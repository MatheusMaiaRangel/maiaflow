using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using static MaiaFlow.Tests.Integration.TestClient;

namespace MaiaFlow.Tests.Integration
{
    [Collection(ApiCollection.Name)]
    public class RateLimitingTests(ApiFixture fixture)
    {
        private WebApplicationFactory<Program> FactoryWithLimits(int login, int signUp, int loginPerAccount = 100, int user = 100) =>
            fixture.Factory.WithWebHostBuilder(builder =>
                builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["RateLimiting:Login:PermitLimit"] = login.ToString(),
                        ["RateLimiting:SignUp:PermitLimit"] = signUp.ToString(),
                        ["RateLimiting:LoginPerAccount:PermitLimit"] = loginPerAccount.ToString(),
                        ["RateLimiting:User:PermitLimit"] = user.ToString()
                    })));

        [Fact]
        public async Task Login_attempts_over_the_limit_get_429_with_retry_after_and_a_problem_body()
        {
            using var factory = FactoryWithLimits(login: 3, signUp: 100);
            var client = factory.CreateClient();
            var attempt = new { email = UniqueEmail(), password = "senha-errada-1" };

            var statuses = new List<HttpStatusCode>();
            HttpResponseMessage? rejected = null;
            for (var i = 0; i < 5; i++)
            {
                var response = await client.PostAsJsonAsync("/api/auth/login", attempt);
                statuses.Add(response.StatusCode);
                if (response.StatusCode == HttpStatusCode.TooManyRequests) rejected ??= response;
            }

            Assert.Equal(
                [HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized,
                 HttpStatusCode.TooManyRequests, HttpStatusCode.TooManyRequests], statuses);
            Assert.NotNull(rejected);
            Assert.True(rejected.Headers.RetryAfter?.Delta > TimeSpan.Zero);
            Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType?.MediaType);
            var body = await rejected.ReadJsonAsync();
            Assert.Equal(429, body.GetProperty("status").GetInt32());
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("detail").GetString()));
        }

        [Fact]
        public async Task Sign_ups_over_the_limit_get_429()
        {
            using var factory = FactoryWithLimits(login: 100, signUp: 2);
            var client = factory.CreateClient();

            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 3; i++)
            {
                var response = await client.PostAsJsonAsync("/api/users",
                    new { name = "Maria Silva", email = UniqueEmail(), password = Password });
                statuses.Add(response.StatusCode);
            }

            Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Created, HttpStatusCode.TooManyRequests], statuses);
        }

        [Fact]
        public async Task Login_and_sign_up_have_separate_budgets_and_other_routes_are_not_limited()
        {
            using var factory = FactoryWithLimits(login: 1, signUp: 1);
            var client = await SignedInClientAsync(factory);

            var me = await client.GetAsync("/api/users/me");
            var secondLogin = await factory.CreateClient()
                .PostAsJsonAsync("/api/auth/login", new { email = UniqueEmail(), password = Password });

            Assert.Equal(HttpStatusCode.OK, me.StatusCode);
            // The first login of the helper used the only permit.
            Assert.Equal(HttpStatusCode.TooManyRequests, secondLogin.StatusCode);
        }

        [Fact]
        public async Task Login_attempts_for_one_account_are_limited_whatever_the_address_and_casing()
        {
            using var factory = FactoryWithLimits(login: 100, signUp: 100, loginPerAccount: 2);
            var client = factory.CreateClient();
            var email = UniqueEmail();

            var statuses = new List<HttpStatusCode>();
            foreach (var variant in new[] { email, email.ToUpperInvariant(), $"  {email} " })
            {
                var response = await client.PostAsJsonAsync("/api/auth/login", new { email = variant, password = "senha-errada-1" });
                statuses.Add(response.StatusCode);
            }
            var otherAccount = await client.PostAsJsonAsync("/api/auth/login", new { email = UniqueEmail(), password = "senha-errada-1" });

            Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], statuses);
            Assert.Equal(HttpStatusCode.Unauthorized, otherAccount.StatusCode);
        }

        [Fact]
        public async Task Signed_in_requests_are_limited_per_user()
        {
            using var factory = FactoryWithLimits(login: 100, signUp: 100, user: 3);
            var first = await SignedInClientAsync(factory);
            var second = await SignedInClientAsync(factory);

            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 4; i++) statuses.Add((await first.GetAsync("/api/tasks")).StatusCode);
            var otherUser = await second.GetAsync("/api/tasks");

            Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], statuses);
            Assert.Equal(HttpStatusCode.OK, otherUser.StatusCode);
        }
    }
}
