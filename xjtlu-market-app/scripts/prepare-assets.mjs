import { mkdir, copyFile, readdir, cp } from "node:fs/promises";
import path from "node:path";
const out = path.resolve("public/vendor");
await mkdir(out, { recursive: true });
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  path.join(out, "pdf.worker.min.mjs"),
);
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.min.mjs",
  path.join(out, "pdf.min.mjs"),
);
await cp("node_modules/pdfjs-dist/cmaps", path.join(out, "cmaps"), {
  recursive: true,
});
await cp(
  "node_modules/pdfjs-dist/standard_fonts",
  path.join(out, "standard_fonts"),
  { recursive: true },
);
await cp("node_modules/pdfjs-dist/wasm", path.join(out, "pdf-wasm"), {
  recursive: true,
});
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  path.join(out, "worker.min.js"),
);
await mkdir(path.join(out, "core"), { recursive: true });
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(
      path.join("node_modules/tesseract.js-core", file),
      path.join(out, "core", file),
    );
}
await copyFile(
  "node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
  path.join(out, "eng.traineddata.gz"),
);
console.log("Local OCR and PDF workers ready");
await copyFile(
  "node_modules/@tesseract.js-data/chi_sim/4.0.0/chi_sim.traineddata.gz",
  path.join(out, "chi_sim.traineddata.gz"),
);
