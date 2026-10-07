export function startPolling(
  task: () => Promise<unknown>,
  delay: number,
  onError?: (error: unknown) => void,
) {
  let active = true,
    timer: ReturnType<typeof setTimeout> | undefined;
  async function run() {
    try {
      await task();
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      if (active) timer = setTimeout(() => void run(), delay);
    }
  }
  void run();
  return () => {
    active = false;
    clearTimeout(timer);
  };
}
