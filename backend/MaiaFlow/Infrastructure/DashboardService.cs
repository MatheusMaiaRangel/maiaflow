using System.Text.Json;
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Dashboard;
using MaiaFlow.Domain.Dashboard;
using MaiaFlow.Domain.Exceptions;

namespace MaiaFlow.Infrastructure
{
    public class DashboardService(IDashboardRepository repository, TimeProvider timeProvider) : IDashboardService
    {
        public const string ConflictMessage =
            "O painel foi alterado em outro aparelho. Recarregue para ver a versão mais nova.";

        // camelCase, as the API answers; optional fields are left out by their JsonIgnore(WhenWritingNull).
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        /// <summary>A refused dashboard lists at most this many problems, so a huge body cannot build a huge answer.</summary>
        private const int MaxReportedErrors = 20;

        public async Task<DashboardDTO> GetAsync(int userId)
        {
            var dashboard = await repository.GetByUserIdAsync(userId);
            if (dashboard is null) return new DashboardDTO(0, null);

            var config = dashboard.Config is null ? null : JsonSerializer.Deserialize<DashboardConfigDTO>(dashboard.Config, Json);
            return new DashboardDTO(dashboard.Revision, config);
        }

        public async Task<DashboardDTO> SaveAsync(int userId, SaveDashboardDTO saveDashboardDto)
        {
            var errors = DashboardValidator.Validate(saveDashboardDto.Config);
            if (errors.Count > 0)
                throw new DomainValidationException(
                    string.Join(" ", errors.Distinct(StringComparer.Ordinal).Take(MaxReportedErrors)));

            // The typed DTO is stored, not the request body, so unknown properties never reach the database.
            var config = Normalize(saveDashboardDto.Config);
            var json = JsonSerializer.Serialize(config, Json);
            var now = timeProvider.GetUtcNow();
            var saved = saveDashboardDto.Revision == 0
                ? await repository.TryCreateAsync(userId, json, now)
                : await repository.TryReplaceAsync(userId, saveDashboardDto.Revision, json, now);
            if (!saved) throw new ConflictException(ConflictMessage);

            return new DashboardDTO(saveDashboardDto.Revision + 1, config);
        }

        // "Restaurar padrão": the row stays (config null, next revision) so a device with an older revision
        // still gets a conflict. Without a row the user already has the default, so nothing is created.
        public async Task ResetAsync(int userId)
        {
            await repository.ResetAsync(userId, timeProvider.GetUtcNow());
        }

        // Drops the fields that do not apply to the chosen kind, so the stored JSON matches the front-end union types.
        private static DashboardConfigDTO Normalize(DashboardConfigDTO config) => config with
        {
            Sections = config.Sections.Select(section => section with
            {
                Widgets = section.Widgets.Select(widget => widget with
                {
                    Period = widget.Period.Kind == "custom"
                        ? widget.Period with { Days = null }
                        : widget.Period with { From = null, To = null },
                    HabitFilter = widget.HabitFilter.Kind == "habit"
                        ? widget.HabitFilter
                        : widget.HabitFilter with { HabitId = null }
                }).ToList()
            }).ToList()
        };
    }
}
