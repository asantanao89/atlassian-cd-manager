#!/usr/bin/env bash
# Starts the Codex worker with nvm + CODEX_WORKER_* from server/.env.
# Used by `make pi` and the macOS LaunchAgent.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKER_DIR="${ROOT_DIR}/tools/codex-worker"
NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
ENV_FILE="${ROOT_DIR}/server/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${CODEX_WORKER_TOKEN:-}" ]]; then
  echo "❌ CODEX_WORKER_TOKEN is required (set it in server/.env)" >&2
  exit 1
fi

if [[ ! -s "${NVM_DIR}/nvm.sh" ]]; then
  echo "❌ nvm not found at ${NVM_DIR}/nvm.sh" >&2
  exit 1
fi

# shellcheck disable=SC1091
source "${NVM_DIR}/nvm.sh"
cd "${ROOT_DIR}"
nvm use

cd "${WORKER_DIR}"
exec npm start
