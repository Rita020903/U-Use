import type { Transaction } from "./database";
import { ApiError } from "./http";
export async function assertNotDeleted(tx: Transaction, id?: string) {
  if (id && (await tx.get("deleted-accounts", id)))
    throw new ApiError("账号已注销，请重新登录", 401);
}
