import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, chmod } from "node:fs/promises";
import path from "node:path";
if (process.env.DATABASE_URL)
  throw new Error(
    "PostgreSQL: use the provider's encrypted backup or pg_dump. This command only backs up SQLite.",
  );
const file =
    process.env.SQLITE_PATH ||
    path.join(
      process.env.DATA_DIRECTORY || path.join(process.cwd(), "data"),
      "private",
      "uuse.sqlite",
    ),
  directory = process.env.BACKUP_DIRECTORY;
if (!directory)
  throw new Error(
    "Set BACKUP_DIRECTORY to a private directory outside Git before running a backup.",
  );
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const db = new DatabaseSync(file, { readOnly: true }),
  target = path.join(
    directory,
    "uuse-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
  );
try {
  await backup(db, target);
  await chmod(target, 0o600);
  console.log("Consistent SQLite backup created: " + target);
} finally {
  db.close();
}
