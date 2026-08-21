using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Habit;
using MaiaFlow.Domain.Habit;

namespace MaiaFlow.Infrastructure
{
    public class HabitService(IHabitRepository habitRepository, IHabitOccurrenceRepository occurrenceRepository)
        : IHabitService
    {
        public async Task<ReadHabitDTO> CreateHabitAsync(int userId, CreateHabitDTO createHabitDto)
        {
            var habit = Habit.Create(
                createHabitDto.Title,
                createHabitDto.Description,
                createHabitDto.StartDate,
                userId,
                createHabitDto.FrequencyType,
                createHabitDto.IntervalDays,
                createHabitDto.DaysOfWeek,
                createHabitDto.DaysOfMonth);

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

        public async Task<ReadHabitDTO?> UpdateHabitDetailsAsync(int userId, int habitId, UpdateHabitDetailsDTO updateDto)
        {
            var habit = await habitRepository.GetByIdAsync(habitId);
            if (habit == null || habit.UserId != userId) return null;

            habit.UpdateDetails(updateDto.Title ?? habit.Title, updateDto.Description ?? habit.Description);

            await habitRepository.UpdateAsync(habit);
            return ToDto(habit);
        }

        public async Task<ReadHabitDTO?> ChangeRecurrenceRuleAsync(int userId, int habitId, ChangeRecurrenceDTO changeDto)
        {
            var habit = await habitRepository.GetByIdAsync(habitId);
            if (habit == null || habit.UserId != userId) return null;

            var effectiveFrom = changeDto.EffectiveFrom ?? DateTime.UtcNow.Date;

            habit.ChangeRecurrenceRule(
                changeDto.FrequencyType,
                changeDto.IntervalDays,
                changeDto.DaysOfWeek,
                changeDto.DaysOfMonth,
                effectiveFrom);

            await habitRepository.UpdateAsync(habit);
            return ToDto(habit);
        }

        public async Task<bool> DeleteHabitAsync(int userId, int habitId)
        {
            var habit = await habitRepository.GetByIdAsync(habitId);
            if (habit == null || habit.UserId != userId) return false;

            await habitRepository.DeleteAsync(habit);
            return true;
        }

        public async Task<List<ReadHabitOccurrenceDTO>> GetCalendarAsync(int userId, DateTime start, DateTime end)
        {
            var habits = await habitRepository.GetByUserIdAsync(userId);
            var today = DateTime.UtcNow.Date;
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
                    var rule = habit.GetCurrentRule();
                    if (rule == null) continue;

                    for (var date = materializeUpTo.AddDays(1); date <= end.Date; date = date.AddDays(1))
                    {
                        if (rule.OccursOn(date))
                            result.Add(new ReadHabitOccurrenceDTO(0, habit.Id, habit.Title, date, HabitOccurrenceStatus.Pending));
                    }
                }
            }

            return result.OrderBy(o => o.Date).ToList();
        }

        public async Task<ReadHabitOccurrenceDTO?> UpdateOccurrenceStatusAsync(int userId, int occurrenceId, UpdateOccurrenceStatusDTO statusDto)
        {
            var occurrence = await occurrenceRepository.GetByIdAsync(occurrenceId);
            if (occurrence == null) return null;

            var habit = await habitRepository.GetByIdAsync(occurrence.HabitId);
            if (habit == null || habit.UserId != userId) return null;

            if (statusDto.Status == HabitOccurrenceStatus.Completed)
                occurrence.MarkAsCompleted();
            else if (statusDto.Status == HabitOccurrenceStatus.NotCompleted)
                occurrence.MarkAsNotCompleted();

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
            await habitRepository.UpdateAsync(habit);
        }

        private static ReadHabitDTO ToDto(Habit habit)
        {
            var rule = habit.GetCurrentRule();
            return new ReadHabitDTO(
                habit.Id,
                habit.Title,
                habit.Description,
                habit.StartDate,
                rule?.FrequencyType ?? default,
                rule?.IntervalDays,
                rule?.DaysOfWeek ?? WeekDays.None,
                rule?.DaysOfMonth ?? new List<int>());
        }

        private static ReadHabitOccurrenceDTO ToOccurrenceDto(HabitOccurrence occurrence, Habit habit)
        {
            return new ReadHabitOccurrenceDTO(occurrence.Id, occurrence.HabitId, habit.Title, occurrence.Date, occurrence.Status);
        }

        private async Task<Habit> GetOwnedHabitAsync(int userId, int habitId)
{
        var habit = await habitRepository.GetByIdAsync(habitId);
            if (habit == null || habit.UserId != userId)
                throw new Exception("Hábito não encontrado");

    return habit;
}
    }
}