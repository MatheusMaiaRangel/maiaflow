using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.TaskItem;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [Route("api/tasks")]
    public class TaskController(ITaskService taskService) : AuthenticatedControllerBase
    {
        /// <summary>Creates a task for the signed-in user. It starts as <c>Pending</c>.</summary>
        [HttpPost]
        [ProducesResponseType<ReadTaskDTO>(StatusCodes.Status201Created)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<ReadTaskDTO>> CreateTask(CreateTaskDTO createTaskDto)
        {
            var response = await taskService.CreateTaskAsync(UserId, createTaskDto);
            return CreatedAtAction(nameof(GetTaskById), new { id = response.Id }, response);
        }

        /// <summary>Lists the signed-in user's tasks.</summary>
        [HttpGet]
        public async Task<ActionResult<List<ReadTaskDTO>>> GetTasks()
        {
            return Ok(await taskService.GetTasksByUserAsync(UserId));
        }

        [HttpGet("{id:int}")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadTaskDTO>> GetTaskById(int id)
        {
            return Ok(await taskService.GetTaskByIdAsync(UserId, id));
        }

        /// <summary>Edits title, description, or due date. Only the fields sent are changed.</summary>
        [HttpPatch("{id:int}")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadTaskDTO>> UpdateTask(int id, UpdateTaskDTO updateTaskDto)
        {
            return Ok(await taskService.UpdateTaskAsync(UserId, id, updateTaskDto));
        }

        [HttpPatch("{id:int}/status")]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<ReadTaskDTO>> UpdateTaskStatus(int id, UpdateTaskStatusDTO updateStatusDto)
        {
            return Ok(await taskService.UpdateTaskStatusAsync(UserId, id, updateStatusDto));
        }

        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteTask(int id)
        {
            await taskService.DeleteTaskAsync(UserId, id);
            return NoContent();
        }
    }
}
