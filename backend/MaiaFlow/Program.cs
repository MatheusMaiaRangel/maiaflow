using System.Reflection;
using System.Text;
using System.Text.Json.Serialization;
using MaiaFlow.Application;
using MaiaFlow.Domain.User;
using MaiaFlow.Domain.TaskItem;
using MaiaFlow.Domain.Habit;
using MaiaFlow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
namespace MaiaFlow
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var connectionString = RequireSetting(builder.Configuration, "ConnectionStrings:DefaultConnection");
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(connectionString));
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(options =>
            {
                
                options.SwaggerDoc("v1", new OpenApiInfo { Title = "MaiaFlow API", Version = "v1" });
                options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme()
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Informe apenas o token JWT."
                });
                // Non-nullable reference types are required and non-nullable; response DTOs are fully required.
                options.SupportNonNullableReferenceTypes();
                options.NonNullableReferenceTypesAsRequired();
                options.SchemaFilter<ContractSchemaFilter>();
                // Optional<T> PATCH fields are plain nullable values on the wire: absent keeps, null clears.
                options.MapType<Optional<string>>(() => NullableSchema(new OpenApiSchema { Type = JsonSchemaType.String }));
                options.MapType<Optional<DateTime?>>(() => NullableSchema(
                    new OpenApiSchema { Type = JsonSchemaType.String, Format = "date-time" }));
                options.IncludeXmlComments(
                    Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml"));
                options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
                {
                    [new OpenApiSecuritySchemeReference("Bearer")] = new List<string>()
                });
            });
            var jwtKey = RequireSetting(builder.Configuration, "Jwt:Key");
            if (jwtKey.Length < MinJwtKeyLength || jwtKey.StartsWith("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"Jwt:Key must be a random value with at least {MinJwtKeyLength} characters " +
                    "(the CHANGE_ME placeholder from the example file is not accepted).");
            }
            var expiresMinutes = builder.Configuration.GetValue("Jwt:ExpiresMinutes", 60);
            if (expiresMinutes is < 5 or > 10080)
            {
                throw new InvalidOperationException("Jwt:ExpiresMinutes must be between 5 and 10080.");
            }
            builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = MaxRequestBodyBytes);
            var jwtIssuer = RequireSetting(builder.Configuration, "Jwt:Issuer");
            var jwtAudience = RequireSetting(builder.Configuration, "Jwt:Audience");
            builder.Services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                        ValidateIssuer = true,
                        ValidIssuer = jwtIssuer,
                        ValidateAudience = true,
                        ValidAudience = jwtAudience,
                        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero
                    };
                });
            builder.Services.AddAuthorization();
            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                    // Enums travel as strings ("Completed"). WeekDays is exposed as an int bit mask in the DTOs.
                    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
            builder.Services.AddProblemDetails();
            builder.Services.AddExceptionHandler<ApiExceptionHandler>();
            var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
            builder.Services.AddCors(options =>
                options.AddPolicy(CorsPolicyName, policy => policy
                    .WithOrigins(corsOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()));
            var timeZoneId = builder.Configuration["TimeZone"] ?? DefaultTimeZoneId;
            TimeZoneInfo timeZone;
            try
            {
                timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
                throw new InvalidOperationException(
                    $"Time zone '{timeZoneId}' was not found. Check the TimeZone setting and that tzdata is installed.", ex);
            }
            builder.Services.AddSingleton<TimeProvider>(new ZonedTimeProvider(timeZone));
            builder.Services.AddScoped<IUserRepository, UserRepository>();
            builder.Services.AddScoped<IUserService, UserService>();
            builder.Services.AddScoped<ITokenService, TokenService>();
            builder.Services.AddScoped<ITaskRepository, TaskRepository>();
            builder.Services.AddScoped<ITaskService, TaskService>();
            builder.Services.AddScoped<IHabitRepository, HabitRepository>();
            builder.Services.AddScoped<IHabitOccurrenceRepository, HabitOccurrenceRepository>();
            builder.Services.AddScoped<IHabitService, HabitService>();
            var app = builder.Build();
            // Configure the HTTP request pipeline.
            app.UseExceptionHandler();
            app.UseStatusCodePages();
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }
            if (!app.Environment.IsDevelopment())
            {
                app.UseHsts();
            }
            app.UseHttpsRedirection();
            
            app.UseCors(CorsPolicyName);
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            app.Run();
        }

        // OpenAPI 3.0 spells "or null" as nullable: true.
        private static OpenApiSchema NullableSchema(OpenApiSchema schema)
        {
            schema.Extensions = new Dictionary<string, IOpenApiExtension> { ["nullable"] = new JsonNodeExtension(true) };
            return schema;
        }

        private const string DefaultTimeZoneId = "America/Sao_Paulo";
        private const int MinJwtKeyLength = 32;
        private const long MaxRequestBodyBytes = 64 * 1024;
        private const string CorsPolicyName = "Frontend";

        // Secrets are not committed (see docs/ROADMAP.md, D7): fail fast with a clear message
        // instead of a NullReferenceException deep inside the framework.
        private static string RequireSetting(IConfiguration configuration, string key)
        {
            var value = configuration[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException(
                    $"Missing configuration '{key}'. Set it with user-secrets or an environment variable; see README.md.");
            }
            return value;
        }
    }
}