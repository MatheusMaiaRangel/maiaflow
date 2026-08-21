using System.Security.Claims;
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Habit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class HabitController(IHabitService _habitService) : ControllerBase
    {
        [HttpPost]
        [Route("/habits")]
        public async Task<ActionResult> CreateHabit(CreateHabitDTO createHabitDto)
        {
            var userId = GetUserId();
            var response = await _habitService.CreateHabitAsync(userId, createHabitDto);
            return Ok(response);
        }

        [HttpGet]
        [Route("/habits")]
        public async Task<ActionResult> GetHabits()
        {
            var userId = GetUserId();
            var response = await _habitService.GetHabitsByUserAsync(userId);
            return Ok(response);
        }

        [HttpGet("/habits/{id}")]
        public async Task<ActionResult> GetHabitById(int id)
        {
            var userId = GetUserId();
            try
            {
                var response = await _habitService.GetHabitByIdAsync(userId, id);
                return Ok(response);
            }
            catch (Exception)
            {
                return NotFound();
            }
        }

        [HttpPatch("/habits/{id}")]
        public async Task<ActionResult> UpdateHabitDetails(int id, UpdateHabitDetailsDTO updateDto)
        {
            var userId = GetUserId();
            var response = await _habitService.UpdateHabitDetailsAsync(userId, id, updateDto);
            if (response == null) return NotFound();
            return Ok(response);
        }

        [HttpPatch("/habits/{id}/recurrence")]
        public async Task<ActionResult> ChangeRecurrence(int id, ChangeRecurrenceDTO changeDto)
        {
            var userId = GetUserId();
            var response = await _habitService.ChangeRecurrenceRuleAsync(userId, id, changeDto);
            if (response == null) return NotFound();
            return Ok(response);
        }

        [HttpDelete("/habits/{id}")]
        public async Task<ActionResult> DeleteHabit(int id)
        {
            var userId = GetUserId();
            var deleted = await _habitService.DeleteHabitAsync(userId, id);
            if (!deleted) return NotFound();
            return Ok("Hábito deletado");
        }

        [HttpGet]
        [Route("/habits/calendar")]
        public async Task<ActionResult> GetCalendar([FromQuery] DateTime start, [FromQuery] DateTime end)
        {
            var userId = GetUserId();
            var response = await _habitService.GetCalendarAsync(userId, start, end);
            return Ok(response);
        }

        [HttpPatch("/habits/occurrences/{occurrenceId}/status")]
        public async Task<ActionResult> UpdateOccurrenceStatus(int occurrenceId, UpdateOccurrenceStatusDTO statusDto)
        {
            var userId = GetUserId();
            var response = await _habitService.UpdateOccurrenceStatusAsync(userId, occurrenceId, statusDto);
            if (response == null) return NotFound();
            return Ok(response);
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.Parse(idClaim!);
        }
    }
}