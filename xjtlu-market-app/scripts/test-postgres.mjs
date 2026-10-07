import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { testRuntime } from "./test-runtime.mjs";
const url = process.env.TEST_DATABASE_URL,
  module = process.env.EMBEDDED_PG_MODULE;
if (!url && !module)
  throw new Error(
    "Provide a dedicated empty TEST_DATABASE_URL, or EMBEDDED_PG_MODULE for a local integration test. Never use the production database.",
  );
const t = await testRuntime();
let postgres, temporary;
try {
  if (module) {
    const { default: EmbeddedPostgres } = await import(
      pathToFileURL(module).href
    );
    const reservation = net.createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const port = reservation.address().port;
    await new Promise((r) => reservation.close(r));
    temporary = await mkdtemp(path.join(os.tmpdir(), "uuse-postgres-"));
    postgres = new EmbeddedPostgres({
      databaseDir: path.join(temporary, "cluster"),
      user: "uuse",
      password: "local-test-only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--locale=C", "--encoding=UTF8"],
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: (message) => console.error(String(message)),
    });
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("uuse_test");
    process.env.DATABASE_URL = `postgresql://uuse:local-test-only@127.0.0.1:${port}/uuse_test`;
  } else process.env.DATABASE_URL = url;
  const { database } = t.load("database");
  assert.equal(
    (await database((tx) => tx.list("products"))).length,
    0,
    "use a dedicated empty test database",
  );
  const now = Date.now(),
    product = {
      id: "pg-test",
      ownerId: "owner",
      status: "可用",
      title: "PG fixture",
      campus: "TAICANG",
      spot: "C 栋公共入口",
      price: 0,
      rentPrice: 2,
      deposit: 5,
      accessMode: "rent",
      returnRequired: true,
      crossCampus: false,
      availableFrom: new Date(now).toISOString().slice(0, 10),
      availableTo: new Date(now + 20 * 86400000).toISOString().slice(0, 10),
    };
  await database(async (tx) => {
    for (const id of ["owner", "one", "two"])
      await tx.put("people", id, {
        id,
        verified: true,
        verificationMode: "email",
      });
    await tx.put("products", product.id, product);
  });
  const input = {
    productId: product.id,
    campus: "TAICANG",
    spot: product.spot,
    time: new Date(now + 86400000).toISOString(),
    returnTime: new Date(now + 2 * 86400000).toISOString(),
    note: "",
    requester: "",
    owner: "",
    depositSnapshot: 0,
  };
  const child = (who) =>
    new Promise((resolve, reject) => {
      const p = spawn(
        process.execPath,
        [
          "-e",
          `const data=require(${JSON.stringify(path.join(t.runtime, "data.js"))});const db=require(${JSON.stringify(path.join(t.runtime, "database.js"))});data.addBooking(${JSON.stringify({ ...input, requesterId: who })}).then(()=>console.log('success')).catch(e=>console.log(e.status===409?'conflict':'error')).finally(()=>db.closeDatabases())`,
        ],
        { env: process.env },
      );
      let output = "";
      p.stdout.on("data", (s) => (output += s));
      p.on("error", reject);
      p.on("close", (code) =>
        code ? reject(new Error("PG child failed")) : resolve(output.trim()),
      );
    });
  assert.deepEqual((await Promise.all([child("one"), child("two")])).sort(), [
    "conflict",
    "success",
  ]);
  await assert.rejects(
    database(async (tx) => {
      await tx.put("meta", "rollback", {});
      throw new Error("rollback");
    }),
    /rollback/,
  );
  assert.equal(await database((tx) => tx.get("meta", "rollback")), undefined);
  await t.load("database").closeDatabases();
  assert.equal((await t.load("data").getBookings(undefined, true)).length, 1);
  console.log(
    "PASS: real PostgreSQL adapter, cross-process atomic reservations, rollback and reconnect persistence",
  );
} finally {
  await t.cleanup();
  await postgres?.stop();
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
