#!/usr/bin/env bash
# Prepares a fresh session: makes sure the .NET 10 SDK is available and restores dependencies.
# Installing the SDK only happens in remote/cloud sessions; on a developer machine a missing SDK
# is reported instead of being installed silently.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

DOTNET_CHANNEL="10.0"
DOTNET_INSTALL_URL="https://dot.net/v1/dotnet-install.sh"

has_dotnet_10() {
  command -v dotnet >/dev/null 2>&1 && dotnet --list-sdks | grep -q '^10\.'
}

if ! has_dotnet_10; then
  if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
    echo "The .NET 10 SDK is not installed. Install it from https://dotnet.microsoft.com/download" >&2
    exit 0
  fi
  installer="$(mktemp)"
  curl -fsSL "$DOTNET_INSTALL_URL" -o "$installer"
  bash "$installer" --channel "$DOTNET_CHANNEL" --install-dir "$HOME/.dotnet"
  rm -f "$installer"
  export PATH="$HOME/.dotnet:$PATH"
  # Keep dotnet on PATH for the rest of the session.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$HOME/.dotnet:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

dotnet tool restore
dotnet restore backend/MaiaFlow

if [ -f frontend/package.json ]; then
  (cd frontend && npm install --no-audit --no-fund)
fi
