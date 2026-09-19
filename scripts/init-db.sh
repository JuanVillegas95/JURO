#!/usr/bin/env bash
set -euo pipefail

npm --prefix server run build >/dev/null
node --input-type=module -e '
  import { JuroDatabase } from "./server/dist/db.js";
  const database = new JuroDatabase();
  database.close();
  console.log("JURO SQLite database is ready.");
'
