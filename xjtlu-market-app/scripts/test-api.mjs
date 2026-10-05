import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { randomUUID } from "node:crypto";

const reservation = net.createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const password = randomUUID();
const headers = { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`, "Content-Type": "application/json" };
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", DEMO_MODE: "false", ADMIN_PASSWORD: password }, stdio: "ignore" });
const url = `http://127.0.0.1:${port}`;
try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (Date.now() < deadline && server.exitCode === null) {
    try { if ((await fetch(`${url}/api/products`)).status === 200) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "build the app before running test:api");
  for (const route of ["/admin", "/api/products?admin=1", "/api/bookings", "/api/reports"]) {
    assert.equal((await fetch(url + route)).status, 401, `anonymous access blocked: ${route}`);
    assert.equal((await fetch(url + route, { headers })).status, 200, `admin access works: ${route}`);
  }
  for (const kind of ["products", "bookings", "reports"]) {
    const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: "null" };
    assert.equal((await fetch(`${url}/api/${kind}`, options)).status, 401, "production mutation requires login");
    assert.equal((await fetch(`${url}/api/${kind}`, { ...options, headers })).status, 400, "malformed body returns a controlled error");
  }
  assert.equal((await fetch(`${url}/api/bookings`, { method: "POST", headers: { ...headers, Origin: "https://unrelated.example" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${url}/api/products?sort=invalid`)).status, 400);
  console.log("PASS: production access control, authorized admin, malformed JSON, cross-site writes, invalid sort");
} finally {
  if (server.exitCode === null) { const stopped = once(server, "exit"); server.kill("SIGTERM"); await stopped; }
}
