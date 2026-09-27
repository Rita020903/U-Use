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
const seed = path.join(root, "data", "products.seed.json");
const target = path.join(root, "data", "products.json");

await copyFile(seed, target);
const products = JSON.parse(await readFile(target, "utf8"));

console.log(`已恢复演示数据：${products.length} 件物品 -> data/products.json`);
console.log("学生端 http://localhost:3000　管理端 http://localhost:3000/admin");
