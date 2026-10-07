export type CourseBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  day: number;
};
export function detectCourseBoxes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): CourseBox[] {
  const colored = (i: number) => {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2];
    return (
      Math.max(r, g, b) - Math.min(r, g, b) > 28 && Math.max(r, g, b) > 130
    );
  };
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const boxes: CourseBox[] = [];
  for (let i = 0; i < visited.length; i++) {
    if (visited[i] || !colored(i)) continue;
    const seedR = pixels[i * 4],
      seedG = pixels[i * 4 + 1],
      seedB = pixels[i * 4 + 2];
    let head = 0,
      tail = 1,
      minX = width,
      maxX = 0,
      minY = height,
      maxY = 0;
    queue[0] = i;
    visited[i] = 1;
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = Math.floor(p / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const n of [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        p - width,
        p + width,
      ]) {
        if (
          n >= 0 &&
          n < visited.length &&
          !visited[n] &&
          colored(n) &&
          Math.abs(pixels[n * 4] - seedR) +
            Math.abs(pixels[n * 4 + 1] - seedG) +
            Math.abs(pixels[n * 4 + 2] - seedB) <
            45
        ) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (
      maxX - minX > width * 0.05 &&
      maxY - minY > height * 0.035 &&
      tail > width * height * 0.003
    )
      boxes.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        day: 0,
      });
  }
  if (!boxes.length) return [];
  // Header borders preserve merged weekday columns, including a double-width Thursday.
  const headerHeight = Math.max(5, Math.min(...boxes.map((b) => b.y)));
  const boundaries: number[] = [];
  for (let x = 0; x < width; x++) {
    let dark = 0,
      total = 0;
    for (let y = 2; y < headerHeight - 2; y++) {
      const i = (y * width + x) * 4;
      total++;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 145) dark++;
    }
    if (
      dark / total > 0.8 &&
      (!boundaries.length || x - boundaries[boundaries.length - 1] > 5)
    )
      boundaries.push(x);
  }
  const reliable = boundaries.length === 7 || boundaries.length === 9;
  const result = boxes.sort((a, b) => a.x - b.x || a.y - b.y).slice(0, 100);
  return result.map((b) => {
    const center = b.x + b.width / 2;
    const index = reliable
      ? boundaries.findIndex(
          (right, n) => n > 1 && center < right && center > boundaries[n - 1],
        )
      : -1;
    return { ...b, day: index >= 2 ? index - 1 : 0 };
  });
}
