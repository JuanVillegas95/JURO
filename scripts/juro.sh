#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
APP_URL="http://${HOST}:${PORT}"
WEB_LOG="${JURO_WEB_LOG:-${ROOT_DIR}/.juro-web.log}"
WEB_PID_FILE="${JURO_WEB_PID_FILE:-${ROOT_DIR}/.juro-web.pid}"

info() { printf '[JURO] %s\n' "$*"; }
warn() { printf '[JURO] Aviso: %s\n' "$*" >&2; }
fail() { printf '[JURO] Error: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js no está instalado. Instala Node.js 22.16 o posterior."
command -v npm >/dev/null 2>&1 || fail "npm no está disponible. Instala npm junto con Node.js."
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 16) ? 0 : 1)' \
  || fail "Se requiere Node.js 22.16 o posterior; versión detectada: $(node --version)."
info "Node.js $(node --version) y npm $(npm --version) disponibles."

if [[ ! -x frontend/node_modules/.bin/vite || ! -x server/node_modules/.bin/tsx ]]; then
  info "Faltan dependencias locales; instalándolas ahora."
  npm run install:all
else
  info "Dependencias de frontend y servidor disponibles."
fi

for tool in java javac python3 node go; do
  if command -v "$tool" >/dev/null 2>&1; then
    info "$tool disponible."
  else
    warn "$tool no está disponible; los problemas que dependan de ese lenguaje no podrán ejecutarse."
  fi
done

if command -v mvn >/dev/null 2>&1; then
  info "mvn disponible (opcional para workflows Java)."
else
  warn "mvn no está disponible; no afecta a los runners básicos de Java."
fi

endpoint_ready() {
  node -e 'fetch(process.argv[1]).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' "$1" >/dev/null 2>&1
}

open_browser() {
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL" >/dev/null 2>&1 || true
  else
    info "Abre manualmente $APP_URL"
  fi
}

if endpoint_ready "${APP_URL}/health"; then
  info "JURO ya estaba ejecutándose."
  open_browser
  exit 0
fi

info "Compilando y levantando JURO."
nohup npm start >"$WEB_LOG" 2>&1 &
web_pid=$!
printf '%s\n' "$web_pid" >"$WEB_PID_FILE"

for ((attempt = 1; attempt <= 60; attempt++)); do
  if endpoint_ready "${APP_URL}/health"; then
    info "JURO está disponible en $APP_URL."
    open_browser
    exit 0
  fi
  sleep 1
done

warn "JURO no respondió después de 60 segundos. Últimas líneas del log:"
tail -n 30 "$WEB_LOG" 2>/dev/null || true
exit 1
