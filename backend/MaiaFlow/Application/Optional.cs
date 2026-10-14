using System.Text.Json;
using System.Text.Json.Serialization;

namespace MaiaFlow.Application
{
    /// <summary>
    /// A PATCH field that tells "not sent" apart from "sent as null". Absent means keep the current
    /// value; <c>null</c> means clear it; any other value replaces it (JSON merge patch semantics).
    /// </summary>
    [JsonConverter(typeof(OptionalJsonConverterFactory))]
    public readonly struct Optional<T>
    {
        public Optional(T value)
        {
            IsSet = true;
            Value = value;
        }

        public bool IsSet { get; }

        public T Value { get; }

        /// <summary>The sent value when the field was sent, otherwise <paramref name="current"/>.</summary>
        public T Resolve(T current) => IsSet ? Value : current;
    }

    public sealed class OptionalJsonConverterFactory : JsonConverterFactory
    {
        public override bool CanConvert(Type typeToConvert) =>
            typeToConvert.IsGenericType && typeToConvert.GetGenericTypeDefinition() == typeof(Optional<>);

        public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        {
            var valueType = typeToConvert.GetGenericArguments()[0];
            return (JsonConverter)Activator.CreateInstance(typeof(OptionalJsonConverter<>).MakeGenericType(valueType))!;
        }
    }

    public sealed class OptionalJsonConverter<T> : JsonConverter<Optional<T>>
    {
        // Without this, a JSON null would skip the converter and look like "not sent".
        public override bool HandleNull => true;

        public override Optional<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null) return new Optional<T>(default!);
            return new Optional<T>(JsonSerializer.Deserialize<T>(ref reader, options)!);
        }

        public override void Write(Utf8JsonWriter writer, Optional<T> value, JsonSerializerOptions options)
        {
            if (!value.IsSet || value.Value is null) writer.WriteNullValue();
            else JsonSerializer.Serialize(writer, value.Value, options);
        }
    }
}
