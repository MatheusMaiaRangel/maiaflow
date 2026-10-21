using System.Text.Json;
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Dashboard;

namespace MaiaFlow.Tests.Application
{
    /// <summary>
    /// The configurations both validators must agree on (D28), read from <c>contracts/dashboard-validation-cases.json</c>
    /// at the repository root. The front end tests the same file.
    /// </summary>
    public static class DashboardCases
    {
        public record Case(string Name, bool Valid, JsonElement Config);

        private const string RelativePath = "contracts/dashboard-validation-cases.json";

        private static readonly Lazy<IReadOnlyList<Case>> Cases = new(Load);

        public static IReadOnlyList<Case> All => Cases.Value;

        public static Case Get(string name) => All.Single(c => c.Name == name);

        public static TheoryData<string> Names() => new(All.Select(c => c.Name));

        /// <summary>
        /// What the API makes of a config: the validator's errors, or a binding error when the JSON does not even
        /// fit the DTOs (a string where a number goes, a missing required number).
        /// </summary>
        public static IReadOnlyList<string> Errors(JsonElement config)
        {
            DashboardConfigDTO? dto;
            try
            {
                dto = config.Deserialize<DashboardConfigDTO>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
            }
            catch (JsonException ex)
            {
                return [$"binding: {ex.Message}"];
            }
            return DashboardValidator.Validate(dto);
        }

        private static IReadOnlyList<Case> Load()
        {
            using var document = JsonDocument.Parse(File.ReadAllText(FindFile()));
            return document.RootElement.GetProperty("cases").EnumerateArray()
                .Select(c => new Case(
                    c.GetProperty("name").GetString()!,
                    c.GetProperty("valid").GetBoolean(),
                    c.GetProperty("config").Clone()))
                .ToList();
        }

        // Tests run from bin/<configuration>/<framework>, a few levels below the repository root.
        private static string FindFile()
        {
            for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
            {
                var candidate = Path.Combine(directory.FullName, RelativePath);
                if (File.Exists(candidate)) return candidate;
            }
            throw new FileNotFoundException($"{RelativePath} was not found above {AppContext.BaseDirectory}.");
        }
    }
}
