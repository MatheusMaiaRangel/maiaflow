using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using MaiaFlow.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace MaiaFlow.Tests.Integration
{
    /// <summary>
    /// One real PostgreSQL container and one in-memory API host shared by all integration tests.
    /// Tests stay isolated from each other by registering their own unique users.
    /// </summary>
    public sealed class ApiFixture : IAsyncLifetime
    {
        private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16").Build();
        private WebApplicationFactory<Program>? _factory;

        public WebApplicationFactory<Program> Factory =>
            _factory ?? throw new InvalidOperationException("Fixture not initialized.");

        public async Task InitializeAsync()
        {
            await _postgres.StartAsync();

            // Program reads configuration while building, before the test host can override it,
            // so the settings go in as environment variables.
            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _postgres.GetConnectionString());
            Environment.SetEnvironmentVariable("Jwt__Key", "integration-tests-only-key-0123456789-abcdef");
            Environment.SetEnvironmentVariable("Cors__AllowedOrigins__0", "http://localhost:3000");

            // Every test registers and signs in its own user from the same (unknown) address, so the
            // production limits on login and sign-up are lifted here. RateLimitingTests brings its own.
            _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
                builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["RateLimiting:Login:PermitLimit"] = "100000",
                        ["RateLimiting:SignUp:PermitLimit"] = "100000",
                        ["RateLimiting:LoginPerAccount:PermitLimit"] = "100000",
                        ["RateLimiting:User:PermitLimit"] = "100000"
                    })));
            using var scope = _factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
        }

        public async Task DisposeAsync()
        {
            if (_factory is not null) await _factory.DisposeAsync();
            await _postgres.DisposeAsync();
        }
    }

    [CollectionDefinition(Name)]
    public class ApiCollection : ICollectionFixture<ApiFixture>
    {
        public const string Name = "Api";
    }
}
