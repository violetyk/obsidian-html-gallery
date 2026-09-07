/**
 * Run at most `limit` tasks at a time. Used to keep PDF work from spawning one pdf.js
 * worker per card when the user scrolls quickly through a folder of PDFs
 */
export function createLimiter(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const waiting: (() => void)[] = [];

  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}
