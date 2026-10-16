using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace MaiaFlow.Infrastructure
{
    /// <summary>A fixed-window limit: at most <see cref="PermitLimit"/> requests per client every <see cref="WindowSeconds"/>.</summary>
    public sealed class RateLimitRule
    {
        public int PermitLimit { get; set; }
        public int WindowSeconds { get; set; }
    }

    /// <summary>Request limits (see <c>RateLimiting</c> in configuration).</summary>
    public sealed class AuthRateLimitSettings
    {
        public const string SectionName = "RateLimiting";

        /// <summary>Login attempts per client address.</summary>
        public RateLimitRule Login { get; set; } = new() { PermitLimit = 10, WindowSeconds = 60 };
        /// <summary>Sign-ups per client address.</summary>
        public RateLimitRule SignUp { get; set; } = new() { PermitLimit = 5, WindowSeconds = 60 };
        /// <summary>
        /// Login attempts per e-mail, whatever the address. Behind a proxy that does not pass the client
        /// address on, every visitor shares one address, so this is what stops guessing one account's password.
        /// </summary>
        public RateLimitRule LoginPerAccount { get; set; } = new() { PermitLimit = 10, WindowSeconds = 60 };
        /// <summary>Requests per signed-in user on the authenticated endpoints.</summary>
        public RateLimitRule User { get; set; } = new() { PermitLimit = 300, WindowSeconds = 60 };
    }

    /// <summary>Counts login attempts per account (normalized e-mail, as stored by the API).</summary>
    public sealed class AccountLoginLimiter : IDisposable
    {
        private readonly PartitionedRateLimiter<string> _limiter;

        public AccountLoginLimiter(IOptions<AuthRateLimitSettings> settings)
        {
            var rule = settings.Value.LoginPerAccount;
            _limiter = PartitionedRateLimiter.Create<string, string>(email =>
                RateLimitPartition.GetFixedWindowLimiter(email, _ => RateLimitingExtensions.FixedWindow(rule)));
        }

        public RateLimitLease AttemptAcquire(string? email) =>
            _limiter.AttemptAcquire((email ?? "").Trim().ToLowerInvariant());

        public void Dispose() => _limiter.Dispose();
    }

    public static class RateLimitingExtensions
    {
        public const string LoginPolicy = "login";
        public const string SignUpPolicy = "signup";
        public const string UserPolicy = "user";
        private const string RejectedMessage = "Muitas tentativas. Aguarde um momento e tente novamente.";
        private const string UnknownClient = "unknown";

        /// <summary>
        /// Per-client limits on login and sign-up, which are open to password guessing and to BCrypt CPU abuse,
        /// a per-account login limit (<see cref="AccountLoginLimiter"/>) and a per-user limit for signed-in calls.
        /// The client is the connection's remote address, so <see cref="UseTrustedForwardedHeaders"/> must run first
        /// when a proxy sits in front, and the limiter must run after authentication so the user is known.
        /// Settings are read when the host starts, so tests can override them.
        /// </summary>
        public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services)
        {
            services.AddOptions<AuthRateLimitSettings>().BindConfiguration(AuthRateLimitSettings.SectionName)
                .Validate(IsValid, "RateLimiting limits and windows must be greater than zero.");

            services.AddOptions<RateLimiterOptions>().Configure<IOptions<AuthRateLimitSettings>>((options, settings) =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddPolicy(LoginPolicy, context => FixedWindowPerClient(LoginPolicy, context, settings.Value.Login));
                options.AddPolicy(SignUpPolicy, context => FixedWindowPerClient(SignUpPolicy, context, settings.Value.SignUp));
                options.AddPolicy(UserPolicy, context => FixedWindowPerUser(context, settings.Value.User));
                options.OnRejected = WriteRejection;
            });
            services.AddRateLimiter();
            services.AddSingleton<AccountLoginLimiter>();
            return services;
        }

        /// <summary>
        /// Trusts <c>X-Forwarded-For</c> / <c>X-Forwarded-Proto</c> only from the networks listed in
        /// <c>ForwardedHeaders:TrustedNetworks</c> (comma-separated CIDRs). Empty means the headers are ignored.
        /// </summary>
        public static IServiceCollection AddTrustedForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
        {
            var networks = ParseNetworks(configuration["ForwardedHeaders:TrustedNetworks"]);
            if (networks.Count == 0) return services;

            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                // Walk the chain from the right while the hops are trusted; the first untrusted hop is the client.
                options.ForwardLimit = null;
                options.KnownProxies.Clear();
                options.KnownIPNetworks.Clear();
                foreach (var network in networks) options.KnownIPNetworks.Add(network);
            });
            services.AddSingleton<ForwardedHeadersEnabled>();
            return services;
        }

        public static IApplicationBuilder UseTrustedForwardedHeaders(this IApplicationBuilder app) =>
            app.ApplicationServices.GetService<ForwardedHeadersEnabled>() is null
                ? app
                : app.UseForwardedHeaders();

        public static List<System.Net.IPNetwork> ParseNetworks(string? value)
        {
            var networks = new List<System.Net.IPNetwork>();
            foreach (var part in (value ?? "").Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!System.Net.IPNetwork.TryParse(part, out var network))
                {
                    throw new InvalidOperationException(
                        $"ForwardedHeaders:TrustedNetworks has an invalid CIDR '{part}'. Use values like 172.16.0.0/12.");
                }
                networks.Add(network);
            }
            return networks;
        }

        /// <summary>A 429 problem response (with <c>Retry-After</c>) for limits checked inside an action.</summary>
        public static ActionResult TooManyRequests(this ControllerBase controller, RateLimitLease lease)
        {
            SetRetryAfter(controller.Response, lease);
            return controller.Problem(statusCode: StatusCodes.Status429TooManyRequests, detail: RejectedMessage);
        }

        internal static FixedWindowRateLimiterOptions FixedWindow(RateLimitRule rule) => new()
        {
            PermitLimit = rule.PermitLimit,
            Window = TimeSpan.FromSeconds(rule.WindowSeconds),
            QueueLimit = 0,
            AutoReplenishment = true
        };

        private static bool IsValid(AuthRateLimitSettings settings) =>
            IsValid(settings.Login) && IsValid(settings.SignUp) && IsValid(settings.LoginPerAccount) && IsValid(settings.User);

        private static bool IsValid(RateLimitRule rule) => rule is { PermitLimit: > 0, WindowSeconds: > 0 };

        private static RateLimitPartition<string> FixedWindowPerClient(string policy, HttpContext context, RateLimitRule rule)
        {
            var client = context.Connection.RemoteIpAddress?.ToString() ?? UnknownClient;
            return RateLimitPartition.GetFixedWindowLimiter($"{policy}:{client}", _ => FixedWindow(rule));
        }

        /// <summary>Signed-in callers are counted by user id; anonymous ones (rejected later with 401) by address.</summary>
        private static RateLimitPartition<string> FixedWindowPerUser(HttpContext context, RateLimitRule rule)
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userId is null
                ? FixedWindowPerClient(UserPolicy, context, rule)
                : RateLimitPartition.GetFixedWindowLimiter($"{UserPolicy}:id:{userId}", _ => FixedWindow(rule));
        }

        private static void SetRetryAfter(HttpResponse response, RateLimitLease lease)
        {
            if (lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            {
                response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
            }
        }

        private static async ValueTask WriteRejection(OnRejectedContext context, CancellationToken cancellationToken)
        {
            var response = context.HttpContext.Response;
            response.StatusCode = StatusCodes.Status429TooManyRequests;
            SetRetryAfter(response, context.Lease);

            var problemDetails = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
            await problemDetails.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context.HttpContext,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Detail = RejectedMessage
                }
            });
        }

        /// <summary>Marker registered only when trusted networks are configured.</summary>
        internal sealed class ForwardedHeadersEnabled;
    }
}
