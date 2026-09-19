#!/usr/bin/env bash
set -euo pipefail

npm --prefix server run build
exec npm --prefix server run mcp
