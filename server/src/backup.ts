import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { JuroDatabase } from "./db.js";
import { JuroError } from "./errors.js";

const requiredTables = [
  "problems",
  "problem_examples",
  "problem_test_cases",
  "submissions",
  "problem_review_states",
  "current_problem_context",
  "knowledge_check_sessions",
  "activity_events",
  "practice_sessions",
  "test_attempts",
  "review_history",
  "knowledge_check_history",
  "app_metadata",
] as const;

export interface BackupSummary {
  problems: number;
  submissions: number;
  reviews: number;
  activityEvents: number;
}

export interface BackupRestoreResult {
  restored: true;
  restoredAt: string;
  safetyBackupFile: string;
  summary: BackupSummary;
}

export class BackupService {
  private busy = false;
  private readonly backupDirectory: string;

  constructor(private readonly database: JuroDatabase) {
    this.backupDirectory = path.join(path.dirname(database.databasePath), "backups");
  }

  createExportSnapshot(): string {
    this.acquire();
    try {
      const target = this.tempPath("export");
      this.createSnapshot(target);
      return target;
    } finally {
      this.release();
    }
  }

  restoreFromBuffer(buffer: Buffer): BackupRestoreResult {
    this.acquire();
    const importPath = this.tempPath("import");
    try {
      if (buffer.length === 0) {
        throw new JuroError("INVALID_BACKUP", "The selected backup file is empty.", "Choose a JURO SQLite backup file and try again.", 400);
      }
      fs.writeFileSync(importPath, buffer, { mode: 0o600 });
      const summary = validateBackup(importPath);
      const safetyPath = this.persistentBackupPath();
      this.createSnapshot(safetyPath);
      this.database.replaceFromFile(importPath);
      return {
        restored: true,
        restoredAt: new Date().toISOString(),
        safetyBackupFile: path.basename(safetyPath),
        summary,
      };
    } catch (error) {
      if (error instanceof JuroError) throw error;
      throw new JuroError(
        "BACKUP_RESTORE_FAILED",
        "The database restore failed. Your original database was preserved when possible.",
        "Try another JURO backup file. If the problem continues, keep the automatic safety backup and include the request ID in a report.",
        422,
        { cause: error },
      );
    } finally {
      if (fs.existsSync(importPath)) fs.rmSync(importPath, { force: true });
      this.release();
    }
  }

  cleanupExport(pathname: string): void {
    if (!pathname.startsWith(`${this.backupDirectory}${path.sep}`)) return;
    if (path.basename(pathname).startsWith(".export-")) fs.rmSync(pathname, { force: true });
  }

  private createSnapshot(target: string): void {
    fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 });
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    this.database.checkpoint();
    const escaped = target.replaceAll("'", "''");
    this.database.db.exec(`VACUUM INTO '${escaped}'`);
    validateBackup(target);
  }

  private persistentBackupPath(): string {
    return path.join(this.backupDirectory, `backup-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID()}.sqlite`);
  }

  private tempPath(kind: "export" | "import"): string {
    fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 });
    return path.join(this.backupDirectory, `.${kind}-${randomUUID()}.sqlite`);
  }

  private acquire(): void {
    if (this.busy) {
      throw new JuroError("BACKUP_BUSY", "Another backup operation is already in progress.", "Wait for it to finish and try again.", 409);
    }
    this.busy = true;
  }

  private release(): void {
    this.busy = false;
  }
}

export function validateBackup(databasePath: string): BackupSummary {
  let db: DatabaseSync | null = null;
  try {
    const stats = fs.statSync(databasePath);
    if (!stats.isFile() || stats.size === 0) {
      throw new JuroError("INVALID_BACKUP", "The selected backup is not a usable SQLite file.", "Choose a non-empty JURO SQLite backup file.", 400);
    }
    db = new DatabaseSync(databasePath, { readOnly: true, enableForeignKeyConstraints: true, timeout: 5000 });
    const integrityRow = db.prepare("PRAGMA integrity_check").get() as Record<string, unknown> | undefined;
    const integrity = integrityRow ? String(Object.values(integrityRow)[0] ?? "") : "";
    if (integrity.toLowerCase() !== "ok") {
      throw new JuroError("INVALID_BACKUP", "The selected backup failed SQLite integrity checks.", "Choose another backup file; the current JURO database was not changed.", 422);
    }
    const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyErrors.length > 0) {
      throw new JuroError("INVALID_BACKUP", "The selected backup contains invalid references.", "Choose another JURO backup file; the current database was not changed.", 422);
    }
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const tables = new Set(tableRows.map((row) => String(row.name)));
    const missing = requiredTables.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      throw new JuroError("INCOMPATIBLE_BACKUP", "This backup was not created by JURO or uses an unsupported schema.", `Missing tables: ${missing.join(", ")}.`, 422);
    }
    return {
      problems: count(db, "problems"),
      submissions: count(db, "submissions"),
      reviews: count(db, "review_history"),
      activityEvents: count(db, "activity_events"),
    };
  } catch (error) {
    if (error instanceof JuroError) throw error;
    throw new JuroError("INVALID_BACKUP", "The selected file is not a valid SQLite backup.", "Choose a JURO-generated .sqlite backup file.", 422, { cause: error });
  } finally {
    if (db?.isOpen) db.close();
  }
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return Number(row.count);
}
