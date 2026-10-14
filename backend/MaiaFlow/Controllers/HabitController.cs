using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.Habit;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [Route("api/habits")]
    public class HabitController(IHabitService habitService) : AuthenticatedControllerBase
    {
        /// <summary>Creates a habit with its first recurrence rule, effective from <c>startDate</c>.</summary>
        [HttpPost]
        [ProducesResponseType<ReadHabitDTO>(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ReadHabitDTO>> CreateHabit(CreateHabitDTO createHabitDto)
        {
            var response = await habitService.CreateHabitAsync(UserId, createHabitDto);
            return CreatedAtAction(nameof(GetHabitById), new { id = response.Id }, response);
        }

        [HttpGet]
        public async Task<ActionResult<List<ReadHabitDTO>>> GetHabits()
        {
            return Ok(await habitService.GetHabitsByUserAsync(UserId));
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadHabitDTO>> GetHabitById(int id)
        {
            return Ok(await habitService.GetHabitByIdAsync(UserId, id));
        }

        /// <summary>Edits title or description. Only the fields sent are changed.</summary>
        [HttpPatch("{id:int}")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadHabitDTO>> UpdateHabitDetails(int id, UpdateHabitDetailsDTO updateDto)
        {
            return Ok(await habitService.UpdateHabitDetailsAsync(UserId, id, updateDto));
        }

        /// <summary>
        /// Replaces the recurrence rule from <c>effectiveFrom</c> on; earlier days keep the old rule.
        /// </summary>
        [HttpPatch("{id:int}/recurrence")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadHabitDTO>> ChangeRecurrence(int id, ChangeRecurrenceDTO changeDto)
        {
            return Ok(await habitService.ChangeRecurrenceRuleAsync(UserId, id, changeDto));
        }

        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteHabit(int id)
        {
            await habitService.DeleteHabitAsync(UserId, id);
            return NoContent();
        }

        /// <summary>
        /// Habit occurrences between <c>start</c> and <c>end</c> (inclusive, at most 366 days).
        /// Days up to today are stored occurrences with a real <c>id</c>. Days after today are
        /// calculated on the fly and come with <c>id = 0</c>: they do not exist yet, so their
        /// status cannot be updated until the day arrives.
        /// </summary>
        [HttpGet("calendar")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<List<ReadHabitOccurrenceDTO>>> GetCalendar(
            [FromQuery] DateTime start, [FromQuery] DateTime end)
        {
            return Ok(await habitService.GetCalendarAsync(UserId, start, end));
        }

        /// <summary>Sets an occurrence to <c>Pending</c>, <c>Completed</c>, or <c>NotCompleted</c>.</summary>
        [HttpPatch("occurrences/{occurrenceId:int}/status")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadHabitOccurrenceDTO>> UpdateOccurrenceStatus(
            int occurrenceId, UpdateOccurrenceStatusDTO statusDto)
        {
            return Ok(await habitService.UpdateOccurrenceStatusAsync(UserId, occurrenceId, statusDto));
        }
    }
}
