import { createHash } from "node:crypto";
import type { Transaction } from "./database";
import { ApiError } from "./http";
export async function createOnce<T extends { id: string }>(
  tx: Transaction,
  kind: string,
  ownerId: string,
  requestId: unknown,
  input: unknown,
  create: () => Promise<T>,
): Promise<T> {
  if (requestId === undefined) return create();
  if (!ownerId) throw new ApiError("缺少提交账号", 401);
  if (
    typeof requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      requestId,
    )
  )
    throw new ApiError("提交标识无效，请刷新后重试");
  const key = kind + ":" + ownerId + ":" + requestId;
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const existing = await tx.get<{ hash: string; id: string }>(
    "submissions",
    key,
  );
  if (existing) {
    if (existing.hash !== hash)
      throw new ApiError("该提交已处理；修改内容后请使用新的提交标识", 409);
    const record = await tx.get<T>(kind, existing.id);
    if (!record) throw new ApiError("该提交已处理，请查看历史记录", 409);
    return record;
  }
  const record = await create();
  await tx.put("submissions", key, { hash, id: record.id });
  return record;
}
