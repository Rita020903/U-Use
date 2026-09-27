import { promises as fs } from "node:fs";
import path from "node:path";
import { Product } from "./types";

const productsPath = path.join(process.cwd(), "data", "products.json");
const DAY_MS = 24 * 60 * 60 * 1000;
let writeQueue = Promise.resolve();

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * 课程原型用本地模拟数据，窗口写死在 JSON 里。
 * 如果某件物品的可用窗口已经全部过去（例如演示时间晚于数据里的日期），
 * 就把窗口按整周向前平移，保证演示时列表里始终有可借物品。
 * 真实运营版本不需要这段逻辑。
 */
export function refreshAvailability(product: Product): Product {
  const from = new Date(`${product.availableFrom}T00:00:00`);
  const to = new Date(`${product.availableTo}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return product;

  const today = startOfToday();
  if (to.getTime() >= today.getTime()) return product;

  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));
  const weeksBehind = Math.ceil((today.getTime() - to.getTime()) / (7 * DAY_MS));
  const shift = weeksBehind * 7 * DAY_MS;
  const shiftedFrom = new Date(from.getTime() + shift);

  return {
    ...product,
    availableFrom: toISODate(shiftedFrom),
    availableTo: toISODate(new Date(shiftedFrom.getTime() + spanDays * DAY_MS)),
  };
}

export async function getProducts(): Promise<Product[]> {
  const raw = await fs.readFile(productsPath, "utf8");
  const products = JSON.parse(raw) as Product[];
  return products.map(refreshAvailability);
}

export async function addProduct(input: Omit<Product, "id" | "status">) {
  const product: Product = {
    ...input,
    id: `p${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    status: "可用"
  };

  writeQueue = writeQueue.then(async () => {
    const products = await getProducts();
    await fs.writeFile(productsPath, JSON.stringify([product, ...products], null, 2));
  });

  await writeQueue;
  return product;
}
