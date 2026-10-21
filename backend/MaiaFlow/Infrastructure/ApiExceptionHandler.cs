using MaiaFlow.Domain.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MaiaFlow.Infrastructure
{
    /// <summary>
    /// Turns exceptions into RFC 9457 <see cref="ProblemDetails"/> responses so clients always get the
    /// same error shape. Unknown exceptions are logged and returned as a generic 500 with no internals.
    /// </summary>
    public class ApiExceptionHandler(
        IProblemDetailsService problemDetailsService,
        ILogger<ApiExceptionHandler> logger) : IExceptionHandler
    {
        private const string UniqueViolationSqlState = "23505";
        private const string ForeignKeyViolationSqlState = "23503";
        private const string DuplicateMessage = "Já existe um registro com esses dados.";
        private const string InvalidSessionMessage = "Sessão inválida. Entre novamente.";
        private const string UnexpectedMessage = "Ocorreu um erro inesperado. Tente novamente.";

        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception,
            CancellationToken cancellationToken)
        {
            var (status, detail) = Map(exception);

            if (status == StatusCodes.Status500InternalServerError)
                logger.LogError(exception, "Unhandled exception on {Method} {Path}",
                    httpContext.Request.Method, httpContext.Request.Path);

            httpContext.Response.StatusCode = status;
            return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = httpContext,
                Exception = exception,
                ProblemDetails = { Status = status, Detail = detail }
            });
        }

        internal static (int Status, string Detail) Map(Exception exception) => exception switch
        {
            DomainValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, exception.Message),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, exception.Message),
            // Kestrel uses 413 when the body is over MaxRequestBodySize.
            BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge }
                => (StatusCodes.Status413PayloadTooLarge, "Requisição muito grande."),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "Requisição inválida."),
            DbUpdateException { InnerException: PostgresException { SqlState: UniqueViolationSqlState } }
                => (StatusCodes.Status409Conflict, DuplicateMessage),
            // The row points to something that no longer exists, typically a deleted user with a still-valid token.
            DbUpdateException { InnerException: PostgresException { SqlState: ForeignKeyViolationSqlState } }
                => (StatusCodes.Status401Unauthorized, InvalidSessionMessage),
            // The same from raw SQL (the dashboard's INSERT ... ON CONFLICT), which is not wrapped by EF.
            PostgresException { SqlState: ForeignKeyViolationSqlState }
                => (StatusCodes.Status401Unauthorized, InvalidSessionMessage),
            _ => (StatusCodes.Status500InternalServerError, UnexpectedMessage)
        };
    }
}
