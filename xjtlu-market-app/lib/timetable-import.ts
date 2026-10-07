import { Lesson, parseLesson, minutes, parseWeekday } from "./timetable";
import { detectCourseBoxes } from "./timetable-grid";
import {
  parseTimetableText,
  positionedLines,
  weekdayAt,
  PositionedText,
} from "./timetable-text";
import type { Worker } from "tesseract.js";
type ImportOptions = {
  language?: "eng" | "eng+chi_sim";
  rawText?: (text: string) => void;
};
export async function readTimetable(
  file: File,
  progress: (s: string) => void,
  signal: AbortSignal,
  preview: (url: string, page?: number) => void,
  options: ImportOptions = {},
): Promise<Lesson[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("文件不能超过 15 MB");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("请选择 JPG、PNG、WebP 或 PDF");
  let worker: Worker | undefined,
    pdf: import("pdfjs-dist").PDFDocumentProxy | undefined,
    loading: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  let cancel!: (reason: Error) => void;
  const aborted = new Promise<never>((_, reject) => {
      cancel = reject;
    }),
    cancellable = <T>(task: Promise<T>) => Promise.race([task, aborted]);
  void aborted.catch(() => {});
  const abort = () => {
    cancel(new Error("已取消识别"));
    void worker?.terminate();
    void loading?.destroy();
  };
  const check = () => {
    if (signal.aborted) throw new Error("已取消识别");
  };
  signal.addEventListener("abort", abort);
  const lessons: Lesson[] = [];
  const sources: string[] = [];
  async function engine() {
    check();
    if (worker) return worker;
    progress("加载本地识别引擎");
    const { createWorker, PSM } = await import("tesseract.js");
    check();
    const activeWorker = await cancellable(
      createWorker(options.language || "eng+chi_sim", 1, {
        workerPath: "/vendor/worker.min.js",
        corePath: "/vendor/core",
        langPath: "/vendor",
        workerBlobURL: false,
        errorHandler: () => {},
      }).then((w) => {
        if (signal.aborted) void w.terminate();
        return w;
      }),
    );
    worker = activeWorker;
    await cancellable(
      activeWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK }),
    );
    return activeWorker;
  }
  async function processPage(
    canvas: HTMLCanvasElement,
    pageIndex: number,
    items: PositionedText[] = [],
  ) {
    check();
    preview(canvas.toDataURL("image/jpeg", 0.8), pageIndex);
    const small = document.createElement("canvas"),
      ratio = Math.min(1, 1000 / canvas.width);
    small.width = Math.round(canvas.width * ratio);
    small.height = Math.round(canvas.height * ratio);
    const ctx = small.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    const boxes = detectCourseBoxes(
      ctx.getImageData(0, 0, small.width, small.height).data,
      small.width,
      small.height,
    );
    small.width = small.height = 0;
    const headerHeight = Math.min(
      ...boxes.map((b) => b.y / ratio),
      canvas.height * 0.15,
    );
    let headers = items.filter((i) => i.y < headerHeight);
    if (
      boxes.length &&
      new Set(headers.map((h) => parseWeekday(h.text)).filter(Boolean)).size <
        2 &&
      headerHeight > 10
    ) {
      progress("识别星期栏");
      const header = document.createElement("canvas");
      header.width = canvas.width;
      header.height = Math.ceil(headerHeight);
      header
        .getContext("2d")!
        .drawImage(
          canvas,
          0,
          0,
          canvas.width,
          headerHeight,
          0,
          0,
          header.width,
          header.height,
        );
      try {
        const result = await cancellable(
          (await engine()).recognize(header, {}, { blocks: true }),
        );
        headers = (result.data.blocks || [])
          .flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
          )
          .map((w) => ({
            text: w.text,
            x: w.bbox.x0,
            y: w.bbox.y0,
            width: w.bbox.x1 - w.bbox.x0,
            height: w.bbox.y1 - w.bbox.y0,
          }));
        if (
          new Set(headers.map((h) => parseWeekday(h.text)).filter(Boolean))
            .size < 2
        )
          headers = [];
      } finally {
        header.width = header.height = 0;
      }
    }
    if (boxes.length) {
      for (let n = 0; n < boxes.length; n++) {
        check();
        progress(`识别第 ${pageIndex + 1} 页课程 ${n + 1}/${boxes.length}`);
        const b = boxes[n],
          rect = {
            x: b.x / ratio,
            y: b.y / ratio,
            w: b.width / ratio,
            h: b.height / ratio,
          };
        const textItems = items.filter(
          (i) =>
            i.x + i.width / 2 >= rect.x &&
            i.x + i.width / 2 <= rect.x + rect.w &&
            i.y >= rect.y &&
            i.y <= rect.y + rect.h,
        );
        let text = positionedLines(textItems),
          confidence = 100;
        if (!/\d{1,2}[:.]\d{2}/.test(text)) {
          const crop = document.createElement("canvas");
          crop.width = Math.ceil(rect.w);
          crop.height = Math.ceil(rect.h);
          crop
            .getContext("2d")!
            .drawImage(
              canvas,
              rect.x,
              rect.y,
              rect.w,
              rect.h,
              0,
              0,
              crop.width,
              crop.height,
            );
          try {
            const result = await cancellable((await engine()).recognize(crop));
            text = result.data.text;
            confidence = result.data.confidence;
          } finally {
            crop.width = crop.height = 0;
          }
        }
        sources.push(text);
        const parsed = parseLesson(
          text,
          weekdayAt(rect.x + rect.w / 2, headers) || b.day,
        );
        parsed.confidence = confidence;
        lessons.push(parsed);
      }
    } else {
      progress(`读取第 ${pageIndex + 1} 页课程文字`);
      let text = positionedLines(items);
      if (!/\d{1,2}[:.]\d{2}\s*[-–—~至]/.test(text))
        text = (await cancellable((await engine()).recognize(canvas))).data
          .text;
      sources.push(text);
      lessons.push(...parseTimetableText(text));
    }
  }
  try {
    check();
    if (isPdf) {
      const modulePath = "/vendor/pdf.min.mjs",
        lib = (await import(
          /* webpackIgnore: true */ modulePath
        )) as typeof import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      loading = lib.getDocument({
        data: await file.arrayBuffer(),
        maxImageSize: 24000000,
        canvasMaxAreaInBytes: 32000000,
        cMapUrl: "/vendor/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/vendor/standard_fonts/",
        wasmUrl: "/vendor/pdf-wasm/",
      });
      pdf = await cancellable(loading.promise);
      if (pdf.numPages > 10) throw new Error("请只导入课表页，最多 10 页");
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        check();
        const page = await pdf.getPage(pageNumber),
          original = page.getViewport({ scale: 1 }),
          viewport = page.getViewport({
            scale: Math.min(3, 2200 / original.width, 3000 / original.height),
          }),
          canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        try {
          await cancellable(page.render({ canvas, viewport }).promise);
          const content = await page.getTextContent(),
            items: PositionedText[] = [];
          for (const item of content.items)
            if ("str" in item && item.str.trim()) {
              const point = viewport.convertToViewportPoint(
                item.transform[4],
                item.transform[5],
              );
              items.push({
                text: item.str,
                x: point[0],
                y: point[1] - item.height * viewport.scale,
                width: item.width * viewport.scale,
                height: item.height * viewport.scale,
              });
            }
          await processPage(canvas, pageNumber - 1, items);
        } finally {
          canvas.width = canvas.height = 0;
          page.cleanup();
        }
      }
    } else {
      const img = await createImageBitmap(file);
      if (img.width * img.height > 24000000) {
        img.close();
        throw new Error("图片过大，请使用清晰的课表截图");
      }
      const ratio = Math.min(1, 2400 / img.width, 3200 / img.height),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      img.close();
      try {
        await processPage(canvas, 0);
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
    check();
    options.rawText?.(sources.join("\n\n"));
    const unique = lessons.filter(
      (l, n) =>
        lessons.findIndex(
          (x) =>
            x.title === l.title &&
            x.day === l.day &&
            x.start === l.start &&
            x.end === l.end &&
            x.room === l.room &&
            x.weeks === l.weeks,
        ) === n,
    );
    if (unique.length > 200)
      throw new Error("识别内容超过 200 条，请只导入当前学期课表");
    if (!unique.length)
      throw new Error("未提取到课程，请从原文补录，或换清晰截图");
    return unique.sort(
      (a, b) =>
        (a.day || 8) - (b.day || 8) ||
        (minutes(a.start) || 0) - (minutes(b.start) || 0),
    );
  } finally {
    signal.removeEventListener("abort", abort);
    await worker?.terminate().catch(() => {});
    await loading?.destroy().catch(() => {});
  }
}
