import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const temporary = await mkdtemp(path.join(os.tmpdir(), "uuse-test-"));
process.env.DATA_DIRECTORY = temporary;
try {
  for (const name of ["types", "booking-state", "data"]) {
    const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
    await writeFile(path.join(temporary, `${name}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
  }
  const { addBooking, getBookings, updateBookingStatus } = createRequire(import.meta.url)(path.join(temporary, "data.js"));
  const start = new Date(Date.now() + 2 * 86400000), end = new Date(start.getTime() + 3600000);
  const product = { id: "test-product", title: "Test calculator", campus: "SIP", status: "可用", crossCampus: false, availableFrom: new Date(Date.now() - 86400000).toISOString().slice(0, 10), availableTo: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) };
  await writeFile(path.join(temporary, "products.json"), JSON.stringify([product]));
  const input = { productId: product.id, productTitle: product.title, campus: "SIP", spot: "CB", time: start.toISOString(), returnTime: end.toISOString(), note: "", requester: "Demo", owner: "Demo", depositSnapshot: 0 };
  const attempts = await Promise.allSettled([addBooking(input), addBooking(input)]);
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1, "only one overlapping request succeeds");
  assert.equal((await getBookings()).length, 1);
  const booking = (await getBookings())[0];
  await assert.rejects(updateBookingStatus(booking.id, "已归还"), /当前状态/);
  await updateBookingStatus(booking.id, "已确认");
  await updateBookingStatus(booking.id, "已取消");
  await addBooking(input);
  await assert.rejects(addBooking({ ...input, productId: "missing" }), /不存在/);
  await assert.rejects(addBooking({ ...input, campus: "TAICANG" }), /跨校区/);
  await assert.rejects(addBooking({ ...input, returnTime: input.time }), /归还时间/);
  await addBooking({ ...input, time: new Date(end.getTime() + 1000).toISOString(), returnTime: new Date(end.getTime() + 3600000).toISOString() });
  assert.equal((await getBookings()).length, 3, "queue recovers after rejected writes");
  const sale = { ...product, id: "test-sale", accessMode: "buy", returnRequired: false };
  await writeFile(path.join(temporary, "products.json"), JSON.stringify([product, sale]));
  const saleInput = { ...input, productId: sale.id, returnTime: input.time };
  const purchase = await addBooking(saleInput);
  await assert.rejects(addBooking({ ...saleInput, time: end.toISOString(), returnTime: end.toISOString() }), /已有预约/);
  await updateBookingStatus(purchase.id, "已确认");
  await updateBookingStatus(purchase.id, "已交付");
  await updateBookingStatus(purchase.id, "已完成");
  await assert.rejects(addBooking(saleInput), /暂不可预约/);
  console.log("PASS: buy handoff completes without return, no duplicate sale, sold item unavailable");
  console.log("PASS: overlapping bookings, cancellation release, state transitions, missing item, campus, date validation, queue recovery");
} finally { await rm(temporary, { recursive: true, force: true }); }
