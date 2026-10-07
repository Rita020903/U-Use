import { NextResponse, after } from "next/server";
import { api, jsonBody, ApiError } from "../../../lib/http";
import { requirePerson } from "../../../lib/people";
import { database } from "../../../lib/database";
import { Notification } from "../../../lib/types";
import { deliverNotifications } from "../../../lib/notifications";
import { notificationHistory } from "../../../lib/notification-history";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const person = await requirePerson(request);
  after(deliverNotifications);
  const query = request.nextUrl.searchParams;
  const result = await notificationHistory(
    person.id,
    query.get("before") || "",
    Number(query.get("limit") || 100),
  );
  return NextResponse.json(result.items, {
    headers: {
      "Cache-Control": "no-store",
      "X-Has-More": String(result.hasMore),
      "X-Oldest-Notification": result.oldest,
      "X-Unread-Count": String(result.unread),
    },
  });
});
export const PATCH = api(async (request) => {
  const person = await requirePerson(request),
    body = await jsonBody(request);
  const result = await database(async (tx) => {
    const changed: string[] = [];
    if (body.all === true) {
      for (const n of await tx.list<Notification>("notifications"))
        if (n.personId === person.id) {
          await tx.put("notifications", n.id, { ...n, read: true });
          changed.push(n.id);
        }
    } else {
      const n = await tx.get<Notification>("notifications", String(body.id));
      if (!n || n.personId !== person.id) throw new ApiError("通知不存在", 404);
      await tx.put("notifications", n.id, { ...n, read: true });
      changed.push(n.id);
    }
    return {
      ids: changed,
      unread: (await tx.list<Notification>("notifications")).filter(
        (n) => n.personId === person.id && !n.read,
      ).length,
    };
  });
  return NextResponse.json({ ok: true, ...result });
});
