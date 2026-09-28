/**
 * 一键恢复演示数据。
 *
 * 演示或测试时发布过的物品会写进 data/products.json。
 * 录制视频或 session 之前跑一次，把数据恢复成干净的 14 件种子物品。
 *
 * 用法：npm run reset
 */
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = [
  ["products.seed.json", "products.json"],
  ["bookings.seed.json", "bookings.json"],
  ["reports.seed.json", "reports.json"]
];

for (const [seedName, targetName] of files) {
  await copyFile(path.join(root, "data", seedName), path.join(root, "data", targetName));
}

const products = JSON.parse(await readFile(path.join(root, "data", "products.json"), "utf8"));
const bookings = JSON.parse(await readFile(path.join(root, "data", "bookings.json"), "utf8"));
const reports = JSON.parse(await readFile(path.join(root, "data", "reports.json"), "utf8"));

console.log(`已恢复演示数据：${products.length} 件物品 -> data/products.json`);
console.log(`已恢复借还记录：${bookings.length} 条 -> data/bookings.json`);
console.log(`已恢复举报记录：${reports.length} 条 -> data/reports.json`);
console.log("学生端 http://localhost:3000　管理端 http://localhost:3000/admin");
