#!/usr/bin/env bash
set -euo pipefail

npm run build
exec npm --prefix server start
