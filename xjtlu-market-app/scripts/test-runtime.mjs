import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";
export async function testRuntime() {
  const runtime = await mkdtemp(path.join(process.cwd(), ".test-runtime-")),
    data = await mkdtemp(path.join(os.tmpdir(), "uuse-data-"));
  for (const file of await readdir("lib"))
    if (file.endsWith(".ts"))
      await writeFile(
        path.join(runtime, file.replace(/\.ts$/, ".js")),
        ts.transpileModule(await readFile(path.join("lib", file), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
  const require = createRequire(import.meta.url),
    load = (name) => require(path.join(runtime, name + ".js"));
  process.env.DATA_DIRECTORY = data;
  process.env.ALLOW_LOCAL_DATABASE = "true";
  process.env.MIGRATE_LEGACY = "false";
  process.env.SEED_DEMO = "false";
  delete process.env.DATABASE_URL;
  delete process.env.SQLITE_PATH;
  delete process.env.SMTP_URL;
  return {
    runtime,
    data,
    load,
    cleanup: async () => {
      await load("database").closeDatabases();
      await rm(runtime, { recursive: true, force: true });
      await rm(data, { recursive: true, force: true });
    },
  };
}
