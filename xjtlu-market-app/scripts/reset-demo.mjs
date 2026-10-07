import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
const file = process.env.SQLITE_PATH;
if (
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_URL ||
  process.env.RESET_DEMO_CONFIRM !== "RESET_DEMO_ONLY" ||
  !file
)
  throw new Error(
    "Reset disabled. Use an isolated SQLITE_PATH and RESET_DEMO_CONFIRM=RESET_DEMO_ONLY. Production and PostgreSQL resets are forbidden.",
  );
const db = new DatabaseSync(file);
try {
  db.exec(
    "BEGIN IMMEDIATE;CREATE TABLE IF NOT EXISTS uuse_records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id))",
  );
  const people = db
    .prepare("SELECT payload FROM uuse_records WHERE kind='people'")
    .all();
  if (people.some((row) => JSON.parse(row.payload).verified))
    throw new Error(
      "Verified accounts found. Refusing to erase a real or authenticated workspace.",
    );
  for (const kind of ["products", "bookings", "reports"]) {
    db.prepare("DELETE FROM uuse_records WHERE kind=?").run(kind);
    for (const item of JSON.parse(
      await readFile(path.join("data", kind + ".seed.json"), "utf8"),
    )) {
      if (kind === "products") item.isDemo = true;
      db.prepare("INSERT INTO uuse_records VALUES(?,?,?)").run(
        kind,
        item.id,
        JSON.stringify(item),
      );
    }
  }
  db.exec("COMMIT");
  console.log(
    "Isolated demo records restored. Timetables and sessions were not deleted.",
  );
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
