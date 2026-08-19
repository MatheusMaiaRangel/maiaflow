using System.Security.Claims;
using MaiaFlow.Application;
using MaiaFlow.Application.DTOs.TaskItem;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MaiaFlow.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TaskController(ITaskService _taskService) : ControllerBase
    {
        [HttpPost]
        [Route("/tasks")]
        public async Task<ActionResult> CreateTask(CreateTaskDTO createTaskDto)
        {
            var userId = GetUserId();
            var response = await _taskService.CreateTaskAsync(userId, createTaskDto);
            return Ok(response);
        }

        [HttpGet]
        [Route("/tasks")]
        public async Task<ActionResult> GetTasks()
        {
            var userId = GetUserId();
            var response = await _taskService.GetTasksByUserAsync(userId);
            return Ok(response);
        }

        [HttpGet("/tasks/{id}")]
        public async Task<ActionResult> GetTaskById(int id)
        {
            var userId = GetUserId();
            try
            {
                var response = await _taskService.GetTaskByIdAsync(userId, id);
                return Ok(response);
            }
            catch (Exception)
            {
                return NotFound();
            }
        }

        [HttpPatch("/tasks/{id}")]
        public async Task<ActionResult> UpdateTask(int id, UpdateTaskDTO updateTaskDto)
        {
            var userId = GetUserId();
            var response = await _taskService.UpdateTaskAsync(userId, id, updateTaskDto);
            if (response == null)
            {
                return NotFound();
            }
            return Ok(response);
        }

        [HttpPatch("/tasks/{id}/status")]
        public async Task<ActionResult> UpdateTaskStatus(int id, UpdateTaskStatusDTO updateStatusDto)
        {
            var userId = GetUserId();
            var response = await _taskService.UpdateTaskStatusAsync(userId, id, updateStatusDto);
            if (response == null)
            {
                return NotFound();
            }
            return Ok(response);
        }

        [HttpDelete("/tasks/{id}")]
        public async Task<ActionResult> DeleteTask(int id)
        {
            var userId = GetUserId();
            var deleted = await _taskService.DeleteTaskAsync(userId, id);
            if (!deleted)
            {
                return NotFound();
            }
            return Ok("Tarefa deletada");
        }

        private int GetUserId()
        {
            var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.Parse(idClaim!);
        }
    }
}