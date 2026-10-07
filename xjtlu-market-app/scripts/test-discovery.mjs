import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testRuntime } from "./test-runtime.mjs";
const t = await testRuntime(),
  { database } = t.load("database"),
  { dateRange, availableInRange, localToday } = t.load("availability"),
  {
    createNeed,
    listNeeds,
    finishNeed,
    offerProduct,
    needProducts,
    availableForNeed,
  } = t.load("needs"),
  { addProduct } = t.load("data"),
  { isTimetableDraft } = t.load("timetable"),
  { productInput } = t.load("product-input");
const now = Date.now(),
  originalNow = Date.now,
  from = localToday(now + 2 * 86400000),
  to = localToday(now + 4 * 86400000),
  owner = {
    id: "requester",
    name: "Requester",
    verified: true,
    verificationMode: "email",
    email: "private@student.xjtlu.edu.cn",
    updatedAt: now,
  },
  lender = {
    id: "lender",
    name: "Lender",
    verified: true,
    verificationMode: "email",
    updatedAt: now,
  },
  outsider = {
    id: "outsider",
    verified: true,
    verificationMode: "email",
    updatedAt: now,
  },
  product = {
    id: "p-test",
    title: "Suitcase",
    ownerId: lender.id,
    campus: "TAICANG",
    accessMode: "rent",
    availableFrom: localToday(),
    availableTo: localToday(now + 30 * 86400000),
    status: "可用",
    rentPrice: 5,
    price: 0,
    deposit: 20,
    returnRequired: true,
    spot: "C 栋公共入口",
    locationId: "tc-c",
    crossCampus: false,
  },
  request = {
    title: "Need suitcase",
    note: "24 inch",
    campus: "TAICANG",
    from,
    to,
    accessMode: "rent",
    budget: 6,
    ownerId: outsider.id,
  };
const put = (kind, value) => database((tx) => tx.put(kind, value.id, value));
try {
  assert.equal(dateRange("", ""), undefined);
  assert.deepEqual(dateRange(from, ""), { from, to: from });
  assert.throws(() => dateRange("2026-02-30", to), /有效/);
  assert.throws(() => dateRange(to, from), /有效/);
  assert(availableInRange(product, [], { from, to }));
  assert(
    !availableInRange({ ...product, availableTo: from }, [], { from, to }),
  );
  const booking = {
    id: "b",
    productId: product.id,
    time: from + "T12:00:00+08:00",
    returnTime: to + "T12:00:00+08:00",
    status: "待确认",
    expiresAt: now + 100000,
    accessModeSnapshot: "rent",
    returnRequiredSnapshot: true,
  };
  assert(!availableInRange(product, [booking], { from, to }));
  assert(
    availableInRange(product, [{ ...booking, expiresAt: now - 1 }], {
      from,
      to,
    }),
  );
  assert(
    !availableInRange(
      product,
      [
        {
          ...booking,
          status: "有争议",
          returnTime: new Date(now - 1).toISOString(),
        },
      ],
      { from, to },
    ),
  );
  assert(
    !availableInRange(
      product,
      [
        {
          ...booking,
          productId: "other",
          offeredProductId: product.id,
          accessModeSnapshot: "swap",
          returnRequiredSnapshot: false,
        },
      ],
      { from, to },
    ),
  );
  for (const p of [owner, lender, outsider]) await put("people", p);
  await put("products", product);
  await assert.rejects(
    createNeed(request, { id: "guest", verified: false }),
    /登录/,
  );
  const n = await createNeed(request, owner);
  assert.equal(
    (await database((tx) => tx.get("needs", n.id))).ownerId,
    owner.id,
  );
  await assert.rejects(offerProduct(n.id, product.id, owner), /自己的求物/);
  await assert.rejects(offerProduct(n.id, product.id, outsider), /自己已通过/);
  await assert.rejects(finishNeed(n.id, outsider, "resolved"), /自己的求物/);
  await put("products", { ...product, rentPrice: 10 });
  await assert.rejects(offerProduct(n.id, product.id, lender), /预算/);
  await put("products", { ...product, status: "审核中" });
  await assert.rejects(offerProduct(n.id, product.id, lender), /自己已通过/);
  await put("products", { ...product, campus: "SIP" });
  await assert.rejects(offerProduct(n.id, product.id, lender), /校区/);
  await put("products", product);
  await put("bookings", booking);
  await assert.rejects(offerProduct(n.id, product.id, lender), /已被预约/);
  await put("bookings", { ...booking, status: "已取消" });
  const concurrent = await Promise.allSettled([
    offerProduct(n.id, product.id, lender),
    offerProduct(n.id, product.id, lender),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  const publicNeed = (await listNeeds("TAICANG")).items[0];
  assert(!("ownerId" in publicNeed));
  assert(!("email" in publicNeed));
  assert.deepEqual(publicNeed.offers, []);
  assert.equal(
    (await listNeeds("TAICANG", owner.id)).items[0].offers.length,
    1,
  );
  assert((await listNeeds("TAICANG", owner.id)).items[0].offers[0].available);
  assert.equal((await needProducts(n.id, lender)).length, 1);
  await put("bookings", booking);
  assert.equal((await needProducts(n.id, lender)).length, 0);
  assert.equal(
    (await listNeeds("TAICANG", owner.id)).items[0].offers[0].available,
    false,
  );
  await put("bookings", { ...booking, status: "已取消" });
  const buy = {
    ...product,
    accessMode: "buy",
    returnRequired: false,
    price: 5,
    availableFrom: to,
  };
  assert(
    availableForNeed(
      buy,
      { ...request, status: "open", accessMode: "buy" },
      [],
    ),
    "buy need accepts delivery later within the requested window",
  );
  assert(
    !availableForNeed(
      { ...buy, availableFrom: localToday(now + 5 * 86400000) },
      { ...request, status: "open", accessMode: "buy" },
      [],
    ),
  );
  assert.equal(
    (await listNeeds("TAICANG", lender.id)).items[0].offers.length,
    1,
  );
  assert.deepEqual(
    (await listNeeds("TAICANG", outsider.id)).items[0].offers,
    [],
  );
  assert.equal(
    (await database((tx) => tx.list("notifications")))[0].needId,
    n.id,
  );
  await finishNeed(n.id, owner, "resolved");
  assert.deepEqual(await finishNeed(n.id, owner, "resolved"), { ok: true });
  assert.equal((await listNeeds("TAICANG")).items.length, 0);
  assert.equal(
    (await listNeeds("TAICANG", owner.id, true)).items[0].status,
    "resolved",
  );
  await assert.rejects(offerProduct(n.id, product.id, lender), /结束/);
  const expiring = await createNeed(
    { ...request, from: localToday(), to: localToday() },
    owner,
  );
  Date.now = () => now + 2 * 86400000;
  assert.equal((await listNeeds("TAICANG")).items.length, 0);
  assert.equal(
    (await listNeeds("TAICANG", owner.id, true)).items.find(
      (n) => n.id === expiring.id,
    ).status,
    "expired",
  );
  Date.now = originalNow;
  const requestId = randomUUID();
  const retries = await Promise.all([
    createNeed({ ...request, requestId }, owner),
    createNeed({ ...request, requestId }, owner),
  ]);
  assert.equal(retries[0].id, retries[1].id);
  await assert.rejects(
    createNeed({ ...request, requestId, title: "Different" }, owner),
    /提交已处理/,
  );
  await assert.rejects(
    createNeed({ ...request, requestId: "bad" }, owner),
    /提交标识无效/,
  );
  const secondOwner = await createNeed({ ...request, requestId }, outsider);
  assert.notEqual(secondOwner.id, retries[0].id);
  const productKey = randomUUID();
  const published = await Promise.all([
    addProduct(product, productKey),
    addProduct(product, productKey),
  ]);
  assert.equal(published[0].id, published[1].id);
  await assert.rejects(
    addProduct({ ...product, title: "Changed" }, productKey),
    /提交已处理/,
  );
  assert(!isTimetableDraft({ weekOne: "", lessons: [null] }));
  assert(!isTimetableDraft({ weekOne: {}, lessons: [] }));
  assert(isTimetableDraft({ weekOne: "", lessons: [] }));
  await finishNeed(retries[0].id, owner, "withdrawn");
  await finishNeed(secondOwner.id, outsider, "withdrawn");
  const photoId = "12345678-1234-1234-1234-123456789abc";
  await put("photos", { id: photoId, ownerId: lender.id });
  const body = {
    ...product,
    category: "出行用品",
    condition: "Working",
    returnRule: "Return clean",
    photos: ["/api/photos/" + photoId],
  };
  assert.equal(
    (await productInput(body, lender)).handoffCoordinates,
    undefined,
  );
  await assert.rejects(
    productInput({ ...body, handoffCoordinates: null }, lender),
    /地图标记/,
  );
  await assert.rejects(
    productInput({ ...body, handoffCoordinates: { lat: 0, lng: 0 } }, lender),
    /地图标记/,
  );
  console.log(
    "PASS: date range validation and booking occupancy, authenticated needs, own-product responses, private offers, concurrent deduplication, budget/campus checks, expiry, notifications, optional map pins",
  );
} finally {
  Date.now = originalNow;
  await t.cleanup();
}
