using System.Reflection;
using System.Text.Json;
using MaiaFlow.Application;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MaiaFlow.Infrastructure
{
    /// <summary>
    /// Shapes the OpenAPI document so clients generated from it are precise:
    /// <list type="bullet">
    /// <item>Response DTOs always send every property (null included), so all of them are required
    /// (<c>id: number</c> instead of <c>id?: number</c>).</item>
    /// <item><see cref="Optional{T}"/> PATCH fields may be omitted, so they are never required.</item>
    /// <item>A nullable property holding another DTO (<c>DashboardDTO.config</c>) is a bare <c>$ref</c>, which
    /// OpenAPI 3.0 cannot mark nullable; it becomes <c>allOf: [$ref], nullable: true</c>.</item>
    /// </list>
    /// </summary>
    public class ContractSchemaFilter : ISchemaFilter
    {
        public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
        {
            if (schema is not OpenApiSchema openApiSchema || openApiSchema.Properties is null) return;

            MarkNullableReferences(openApiSchema, context.Type);

            if (IsResponseDto(context.Type))
                openApiSchema.Required = new HashSet<string>(openApiSchema.Properties.Keys);

            if (openApiSchema.Required is null) return;
            foreach (var property in context.Type.GetProperties())
            {
                if (IsOptional(property.PropertyType))
                    openApiSchema.Required.Remove(JsonNamingPolicy.CamelCase.ConvertName(property.Name));
            }
        }

        private static void MarkNullableReferences(OpenApiSchema schema, Type type)
        {
            var nullability = new NullabilityInfoContext();
            foreach (var property in type.GetProperties())
            {
                var name = JsonNamingPolicy.CamelCase.ConvertName(property.Name);
                if (schema.Properties!.TryGetValue(name, out var propertySchema)
                    && propertySchema is OpenApiSchemaReference reference
                    && nullability.Create(property).ReadState == NullabilityState.Nullable)
                {
                    schema.Properties[name] = new OpenApiSchema
                    {
                        AllOf = [reference],
                        Extensions = new Dictionary<string, IOpenApiExtension> { ["nullable"] = new JsonNodeExtension(true) }
                    };
                }
            }
        }

        private static bool IsOptional(Type type) =>
            type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Optional<>);

        private static bool IsResponseDto(Type type) =>
            type.Namespace?.StartsWith("MaiaFlow.Application.DTOs", StringComparison.Ordinal) == true
            && (type.Name.StartsWith("Read", StringComparison.Ordinal) || type.Name is "AuthResponseDTO" or "DashboardDTO");
    }
}
