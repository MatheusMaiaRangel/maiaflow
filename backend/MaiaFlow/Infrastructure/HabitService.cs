using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Habit;
using MaiaFlow.Domain.Exceptions;
using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Infrastructure
{
    public class HabitService(
        IHabitRepository habitRepository,
        IHabitOccurrenceRepository occurrenceRepository,
        TimeProvider timeProvider) : IHabitService
    {
        private const int MaxCalendarRangeDays = 366;
        private const int MaxHabitsPerUser = 200;
        private const int MaxStartYearsInPast = 2;     // keeps first-time occurrence generation small
        private const int MaxYearsInFuture = 5;
        private const int MaxCalendarYearsInPast = 10;


        // "Today" is the calendar day in the configured time zone (Brasília), not the UTC day.
        private DateTime Today => timeProvider.GetLocalNow().Date;

        public async Task<ReadHabitDTO> CreateHabitAsync(int userId, CreateHabitDTO createHabitDto)
        {
            if (await habitRepository.CountByUserIdAsync(userId) >= MaxHabitsPerUser)
                throw new DomainValidationException($"Limite de {MaxHabitsPerUser} hábitos atingido.");

            ValidateDateWindow(createHabitDto.StartDate, "A data de início", MaxStartYearsInPast);

            var habit = Habit.Create(
                createHabitDto.Title,
                createHabitDto.Description,
                createHabitDto.StartDate,
                userId,
                createHabitDto.FrequencyType,
                createHabitDto.IntervalDays,
                (WeekDays)createHabitDto.DaysOfWeek,
                createHabitDto.DaysOfMonth,
                createHabitDto.LastDayOfMonth);

            await habitRepository.AddAsync(habit);

            return ToDto(habit);
        }

        public async Task<ReadHabitDTO> GetHabitByIdAsync(int userId, int habitId)
        {
            var habit = await GetOwnedHabitAsync(userId, habitId);
            return ToDto(habit);
        }

        public async Task<List<ReadHabitDTO>> GetHabitsByUserAsync(int userId)
        {
            var habits = await habitRepository.GetByUserIdAsync(userId);
            return habits.Select(ToDto).ToList();
        }

        public async Task<ReadHabitDTO> UpdateHabitDetailsAsync(int userId, int habitId, UpdateHabitDetailsDTO updateDto)
        {
            var habit = await GetOwnedHabitAsync(userId, habitId);

            habit.UpdateDetails(updateDto.Title ?? habit.Title, updateDto.Description.Resolve(habit.Description));

            await habitRepository.UpdateAsync(habit);
            return ToDto(habit);
        }

        public async Task<ReadHabitDTO> ChangeRecurrenceRuleAsync(int userId, int habitId, ChangeRecurrenceDTO changeDto)
        {
            var habit = await GetOwnedHabitAsync(userId, habitId);

            if (changeDto.EffectiveFrom.HasValue)
                ValidateDateWindow(changeDto.EffectiveFrom.Value, "A data de início da recorrência", MaxStartYearsInPast);

            var effectiveFrom = changeDto.EffectiveFrom ?? habit.EarliestRecurrenceChange(Today);

            habit.ChangeRecurrenceRule(
                changeDto.FrequencyType,
                changeDto.IntervalDays,
                (WeekDays)changeDto.DaysOfWeek,
                changeDto.DaysOfMonth,
                effectiveFrom,
                changeDto.LastDayOfMonth);

            await habitRepository.UpdateAsync(habit);
            return ToDto(habit);
        }

        public async Task DeleteHabitAsync(int userId, int habitId)
        {
            var habit = await GetOwnedHabitAsync(userId, habitId);
            await habitRepository.DeleteAsync(habit);
        }

        public async Task<List<ReadHabitOccurrenceDTO>> GetCalendarAsync(int userId, DateTime start, DateTime end)
        {
            ValidateCalendarRange(start, end);
            ValidateDateWindow(start, "A data start", MaxCalendarYearsInPast);
            ValidateDateWindow(end, "A data end", MaxCalendarYearsInPast);

            var habits = await habitRepository.GetByUserIdAsync(userId);
            var today = Today;
            var materializeUpTo = today < end.Date ? today : end.Date;

            // Os dias já passados/hoje existam como Pending no banco
            foreach (var habit in habits)
            {
                if (materializeUpTo >= habit.StartDate.Date)
                    await GenerateOccurrencesUpToAsync(habit, materializeUpTo);
            }

            var habitsById = habits.ToDictionary(h => h.Id);

            // Busca as ocorrências reais (já gravadas) no intervalo
            var occurrences = await occurrenceRepository.GetByUserIdAndDateRangeAsync(userId, start, end);
            var result = occurrences
                .Where(o => habitsById.ContainsKey(o.HabitId))
                .Select(o => ToOccurrenceDto(o, habitsById[o.HabitId]))
                .ToList();

            // Datas futuras (além de hoje) só são calculadas na hora, sem gravar
            if (end.Date > materializeUpTo)
            {
                foreach (var habit in habits)
                {
                    for (var date = materializeUpTo.AddDays(1); date <= end.Date; date = date.AddDays(1))
                    {
                        if (date < start.Date) continue;

                        // The rule can change in the future, so look it up day by day.
                        var rule = habit.GetRuleAt(date);
                        if (rule != null && rule.OccursOn(date))
                            result.Add(new ReadHabitOccurrenceDTO(0, habit.Id, habit.Title, date, HabitOccurrenceStatus.Pending));
                    }
                }
            }

            return result.OrderBy(o => o.Date).ThenBy(o => o.HabitId).ToList();
        }

        public async Task<ReadHabitOccurrenceDTO> UpdateOccurrenceStatusAsync(int userId, int occurrenceId, UpdateOccurrenceStatusDTO statusDto)
        {
            var occurrence = await occurrenceRepository.GetByIdAsync(occurrenceId);
            if (occurrence == null) throw new NotFoundException("Ocorrência não encontrada.");

            var habit = await habitRepository.GetByIdAsync(occurrence.HabitId);
            if (habit == null || habit.UserId != userId) throw new NotFoundException("Ocorrência não encontrada.");

            if (!Enum.IsDefined(statusDto.Status))
                throw new DomainValidationException("Status inválido.");

            switch (statusDto.Status)
            {
                case HabitOccurrenceStatus.Completed:
                    occurrence.MarkAsCompleted();
                    break;
                case HabitOccurrenceStatus.NotCompleted:
                    occurrence.MarkAsNotCompleted();
                    break;
                case HabitOccurrenceStatus.Pending:
                    occurrence.MarkAsPending();
                    break;
            }

            await occurrenceRepository.UpdateAsync(occurrence);
            return ToOccurrenceDto(occurrence, habit);
        }

        private async Task GenerateOccurrencesUpToAsync(Habit habit, DateTime upToDate)
        {
            var startDate = habit.OccurrencesGeneratedUntil?.AddDays(1) ?? habit.StartDate.Date;
            if (startDate > upToDate) return;

            var toCreate = new List<HabitOccurrence>();
            for (var date = startDate; date <= upToDate; date = date.AddDays(1))
            {
                var rule = habit.GetRuleAt(date);
                if (rule != null && rule.OccursOn(date))
                    toCreate.Add(HabitOccurrence.Create(habit.Id, date));
            }

            if (toCreate.Count > 0)
                await occurrenceRepository.AddRangeAsync(toCreate);

            habit.MarkOccurrencesGeneratedUntil(upToDate);
            await habitRepository.AdvanceOccurrencesGeneratedUntilAsync(habit.Id, upToDate);
        }

        // Dates far from today are never useful and would make the server generate or loop over huge ranges.
        private void ValidateDateWindow(DateTime date, string label, int maxYearsInPast)
        {
            if (date.Date < Today.AddYears(-maxYearsInPast) || date.Date > Today.AddYears(MaxYearsInFuture))
                throw new DomainValidationException(
                    $"{label} deve estar entre {maxYearsInPast} anos no passado e {MaxYearsInFuture} anos no futuro.");
        }

        private static void ValidateCalendarRange(DateTime start, DateTime end)
        {
            if (start == default || end == default)
                throw new DomainValidationException("Informe as datas start e end.");

            if (end.Date < start.Date)
                throw new DomainValidationException("A data end não pode ser anterior à data start.");

            if ((end.Date - start.Date).TotalDays >= MaxCalendarRangeDays)
                throw new DomainValidationException($"O intervalo máximo é de {MaxCalendarRangeDays} dias.");
        }

        private static ReadHabitDTO ToDto(Habit habit)
        {
            var rule = habit.GetCurrentRule();
            return new ReadHabitDTO(
                habit.Id,
                habit.Title,
                habit.Description,
                habit.StartDate,
                rule?.EffectiveFrom ?? habit.StartDate,
                rule?.FrequencyType ?? default,
                rule?.IntervalDays,
                (int)(rule?.DaysOfWeek ?? WeekDays.None),
                rule?.DaysOfMonth ?? new List<int>(),
                rule?.LastDayOfMonth ?? false);
        }

        private static ReadHabitOccurrenceDTO ToOccurrenceDto(HabitOccurrence occurrence, Habit habit)
        {
            return new ReadHabitOccurrenceDTO(occurrence.Id, occurrence.HabitId, habit.Title, occurrence.Date, occurrence.Status);
        }

        private async Task<Habit> GetOwnedHabitAsync(int userId, int habitId)
        {
            var habit = await habitRepository.GetByIdAsync(habitId);
            if (habit == null || habit.UserId != userId)
                throw new NotFoundException("Hábito não encontrado.");

            return habit;
        }
    }
}