import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { Pool, PoolClient } from "pg";

export interface Transaction {
  get<T>(kind: string, id: string): Promise<T | undefined>;
  list<T>(kind: string): Promise<T[]>;
  entries<T>(kind: string): Promise<{ id: string; value: T }[]>;
  put(kind: string, id: string, value: unknown): Promise<void>;
  remove(kind: string, id: string): Promise<void>;
}
type Local = { db: DatabaseSync; queue: Promise<unknown> };
const globals = globalThis as typeof globalThis & {
  uuseDatabases?: Map<string, Local>;
  uusePool?: Pool;
  uusePgReady?: Promise<void>;
};
const schema =
  "CREATE TABLE IF NOT EXISTS uuse_records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(kind,id))";
export const privateDirectory = () =>
  path.join(
    process.env.DATA_DIRECTORY || path.join(process.cwd(), "data"),
    "private",
  );

function sqlite() {
  const file =
    process.env.SQLITE_PATH || path.join(privateDirectory(), "uuse.sqlite");
  globals.uuseDatabases ||= new Map();
  let local = globals.uuseDatabases.get(file);
  if (!local) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    chmodSync(path.dirname(file), 0o700);
    const db = new DatabaseSync(file);
    chmodSync(file, 0o600);
    db.exec(
      "PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
    );
    db.exec(schema);
    local = { db, queue: Promise.resolve() };
    globals.uuseDatabases.set(file, local);
  }
  return local;
}

function localTransaction(db: DatabaseSync): Transaction {
  return {
    async entries<T>(kind: string) {
      return (
        db
          .prepare(
            "SELECT id,payload FROM uuse_records WHERE kind=? ORDER BY id",
          )
          .all(kind) as { id: string; payload: string }[]
      ).map((row) => ({ id: row.id, value: JSON.parse(row.payload) as T }));
    },
    async get<T>(kind: string, id: string) {
      const row = db
        .prepare("SELECT payload FROM uuse_records WHERE kind=? AND id=?")
        .get(kind, id) as { payload: string } | undefined;
      return row ? (JSON.parse(row.payload as string) as T) : undefined;
    },
    async list<T>(kind: string) {
      return (
        db
          .prepare("SELECT payload FROM uuse_records WHERE kind=? ORDER BY id")
          .all(kind) as { payload: string }[]
      ).map((row) => JSON.parse(row.payload) as T);
    },
    async put(kind, id, value) {
      db.prepare(
        "INSERT INTO uuse_records(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
      ).run(kind, id, JSON.stringify(value));
    },
    async remove(kind, id) {
      db.prepare("DELETE FROM uuse_records WHERE kind=? AND id=?").run(
        kind,
        id,
      );
    },
  };
}
function postgresTransaction(client: PoolClient): Transaction {
  return {
    async entries<T>(kind: string) {
      const { rows } = await client.query(
        "SELECT id,payload FROM uuse_records WHERE kind=$1 ORDER BY id",
        [kind],
      );
      return rows.map((row) => ({
        id: row.id,
        value: JSON.parse(row.payload) as T,
      }));
    },
    async get<T>(kind: string, id: string) {
      const { rows } = await client.query(
        "SELECT payload FROM uuse_records WHERE kind=$1 AND id=$2",
        [kind, id],
      );
      return rows[0] ? (JSON.parse(rows[0].payload) as T) : undefined;
    },
    async list<T>(kind: string) {
      const { rows } = await client.query(
        "SELECT payload FROM uuse_records WHERE kind=$1 ORDER BY id",
        [kind],
      );
      return rows.map((row) => JSON.parse(row.payload) as T);
    },
    async put(kind, id, value) {
      await client.query(
        "INSERT INTO uuse_records(kind,id,payload) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
        [kind, id, JSON.stringify(value)],
      );
    },
    async remove(kind, id) {
      await client.query("DELETE FROM uuse_records WHERE kind=$1 AND id=$2", [
        kind,
        id,
      ]);
    },
  };
}

async function migrate(tx: Transaction) {
  if (await tx.get("meta", "initialised-v2")) return;
  const root = process.env.DATA_DIRECTORY || path.join(process.cwd(), "data");
  const legacy = process.env.MIGRATE_LEGACY === "true";
  const seeded = process.env.SEED_DEMO === "true";
  if (legacy || seeded) {
    for (const kind of ["products", "bookings", "reports"]) {
      const file = path.join(root, kind + (legacy ? ".json" : ".seed.json"));
      if (!existsSync(file)) continue;
      for (const item of JSON.parse(readFileSync(file, "utf8"))) {
        if (kind === "products") item.isDemo = !item.ownerId;
        if (
          kind === "bookings" &&
          item.campus === "TAICANG" &&
          /CB/.test(item.spot)
        )
          item.spot = "A 栋公共入口";
        await tx.put(kind, item.id, item);
      }
    }
    const people = path.join(root, "private", "people.json");
    if (legacy && existsSync(people))
      for (const p of JSON.parse(readFileSync(people, "utf8"))) {
        await tx.put("people", p.id, {
          id: p.id,
          timetable: p.timetable,
          updatedAt: p.updatedAt,
        });
        await tx.put(
          "sessions",
          createHash("sha256").update(p.token).digest("hex"),
          { personId: p.id, expiresAt: p.updatedAt + 180 * 86400000 },
        );
      }
  }
  await tx.put("meta", "initialised-v2", { at: Date.now(), legacy, seeded });
}

// All mutations include their reads in one transaction, including booking checks.
export async function database<T>(
  operation: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.DATABASE_URL &&
    process.env.ALLOW_LOCAL_DATABASE !== "true"
  )
    throw new Error(
      "正式部署需要 DATABASE_URL；持久化单机部署可显式设置 ALLOW_LOCAL_DATABASE=true",
    );
  if (process.env.DATABASE_URL) {
    globals.uusePool ||= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 10000,
    });
    globals.uusePgReady ||= globals.uusePool.query(schema).then(() => {});
    await globals.uusePgReady;
    const client = await globals.uusePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query("SELECT pg_advisory_xact_lock(303303)");
      const tx = postgresTransaction(client);
      await migrate(tx);
      const result = await operation(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const local = sqlite();
  const task = local.queue
    .catch(() => {})
    .then(async () => {
      local.db.exec("BEGIN IMMEDIATE");
      try {
        const tx = localTransaction(local.db);
        await migrate(tx);
        const result = await operation(tx);
        local.db.exec("COMMIT");
        return result;
      } catch (error) {
        local.db.exec("ROLLBACK");
        throw error;
      }
    });
  local.queue = task.catch(() => {});
  return task;
}

export async function rateLimit(
  key: string,
  maximum: number,
  duration: number,
) {
  return database(async (tx) => {
    const now = Date.now(),
      id = createHash("sha256").update(key).digest("hex");
    const previous = await tx.get<{ count: number; until: number }>(
      "limits",
      id,
    );
    const current =
      previous && previous.until > now
        ? previous
        : { count: 0, until: now + duration };
    if (current.count >= maximum) return false;
    await tx.put("limits", id, { ...current, count: current.count + 1 });
    return true;
  });
}

export async function closeDatabases() {
  for (const local of globals.uuseDatabases?.values() || []) {
    await local.queue;
    local.db.close();
  }
  globals.uuseDatabases?.clear();
  await globals.uusePool?.end();
  globals.uusePool = undefined;
  globals.uusePgReady = undefined;
}
