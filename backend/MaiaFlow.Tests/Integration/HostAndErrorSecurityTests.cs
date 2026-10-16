using System.Net;
using System.Text;
using System.Text.Json;
using MaiaFlow.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MaiaFlow.Tests.Integration
{
    public class HostAndErrorSecurityTests
    {
        [Collection(ApiCollection.Name)]
        public class AllowedHostsTests(ApiFixture fixture)
        {
            [Fact]
            public async Task Requests_with_an_unlisted_host_header_are_rejected()
            {
                var client = fixture.Factory.CreateClient();
                using var request = new HttpRequestMessage(HttpMethod.Get, "/api/users/me");
                request.Headers.Host = "evil.example";

                var response = await client.SendAsync(request);

                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            }

            [Fact]
            public async Task Requests_with_the_listed_host_reach_the_api()
            {
                var response = await fixture.Factory.CreateClient().GetAsync("/api/users/me");

                Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            }
        }

        public class UnexpectedExceptionTests
        {
            private const string Secret = "connection string Password=hunter2 at /srv/app/Secret.cs:42";

            [Fact]
            public async Task Unexpected_exceptions_return_a_generic_500_without_internals()
            {
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddProblemDetails();
                await using var provider = services.BuildServiceProvider();
                var handler = new ApiExceptionHandler(
                    provider.GetRequiredService<IProblemDetailsService>(), NullLogger<ApiExceptionHandler>.Instance);
                var context = new DefaultHttpContext { RequestServices = provider };
                context.Response.Body = new MemoryStream();

                var handled = await handler.TryHandleAsync(context,
                    new InvalidOperationException(Secret, new Exception("inner " + Secret)), CancellationToken.None);

                Assert.True(handled);
                Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
                context.Response.Body.Position = 0;
                var body = Encoding.UTF8.GetString(((MemoryStream)context.Response.Body).ToArray());
                Assert.DoesNotContain("hunter2", body);
                Assert.DoesNotContain("Secret.cs", body);
                Assert.DoesNotContain("InvalidOperationException", body);
                Assert.False(JsonDocument.Parse(body).RootElement.TryGetProperty("exception", out _));
            }
        }

        public class RequestErrorTests
        {
            [Theory]
            [InlineData(StatusCodes.Status413PayloadTooLarge, StatusCodes.Status413PayloadTooLarge)]
            [InlineData(StatusCodes.Status400BadRequest, StatusCodes.Status400BadRequest)]
            public async Task Bad_requests_keep_the_status_kestrel_gives_them(int kestrelStatus, int expected)
            {
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddProblemDetails();
                await using var provider = services.BuildServiceProvider();
                var handler = new ApiExceptionHandler(
                    provider.GetRequiredService<IProblemDetailsService>(), NullLogger<ApiExceptionHandler>.Instance);
                var context = new DefaultHttpContext { RequestServices = provider };
                context.Response.Body = new MemoryStream();

                await handler.TryHandleAsync(context, new BadHttpRequestException("body", kestrelStatus), CancellationToken.None);

                Assert.Equal(expected, context.Response.StatusCode);
            }
        }

        public class ForwardedHeadersConfigTests
        {
            [Fact]
            public void Trusted_networks_accept_comma_and_semicolon_separated_cidrs()
            {
                var networks = RateLimitingExtensions.ParseNetworks("172.16.0.0/12, 10.0.0.0/8;192.168.0.0/16");

                Assert.Equal(3, networks.Count);
            }

            [Theory]
            [InlineData(null)]
            [InlineData("")]
            [InlineData("  ")]
            public void Empty_trusted_networks_mean_forwarded_headers_stay_off(string? value) =>
                Assert.Empty(RateLimitingExtensions.ParseNetworks(value));

            [Fact]
            public void An_invalid_cidr_fails_fast_with_a_clear_message()
            {
                var error = Assert.Throws<InvalidOperationException>(() => RateLimitingExtensions.ParseNetworks("172.16.0.0/12,not-a-network"));

                Assert.Contains("not-a-network", error.Message);
            }
        }
    }
}
