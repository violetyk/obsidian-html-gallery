import { describe, expect, it } from "vitest";
import { createLimiter } from "../src/async";

const tick = () => new Promise((r) => setTimeout(r, 1));

describe("createLimiter", () => {
  it("never runs more than the limit at once", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    };
    await Promise.all(Array.from({ length: 10 }, () => limit(task)));
    expect(peak).toBe(2);
    expect(active).toBe(0);
  });

  it("returns each task's value", async () => {
    const limit = createLimiter(1);
    const values = await Promise.all([1, 2, 3].map((n) => limit(() => Promise.resolve(n * 2))));
    expect(values).toEqual([2, 4, 6]);
  });

  it("releases the slot when a task rejects", async () => {
    const limit = createLimiter(1);
    await expect(limit(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limit(() => Promise.resolve("after"))).resolves.toBe("after");
  });
});
