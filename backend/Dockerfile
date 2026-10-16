# syntax=docker/dockerfile:1
# Build context: ./backend (see docker-compose.yml).

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so this layer is cached until the project file changes.
# The NuGet cache mount speeds up rebuilds; publish needs the same mount to find the restored packages.
COPY MaiaFlow/MaiaFlow.csproj MaiaFlow/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet restore MaiaFlow/MaiaFlow.csproj

COPY MaiaFlow/ MaiaFlow/
RUN --mount=type=cache,id=nuget,target=/root/.nuget/packages \
    dotnet publish MaiaFlow/MaiaFlow.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# tzdata: the API resolves TimeZone (America/Sao_Paulo) and refuses to start without it.
# curl: used by the health check.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

# The base image ships an unprivileged "app" user.
USER app
EXPOSE 8080

# /api/users/me needs a token, so a running API answers 401 to an anonymous request.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
    CMD test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/users/me)" = "401" || exit 1

ENTRYPOINT ["dotnet", "MaiaFlow.dll"]
