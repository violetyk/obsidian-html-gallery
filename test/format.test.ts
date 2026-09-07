import { describe, expect, it } from "vitest";
import { formatDate } from "../src/format";

describe("formatDate", () => {
  // Built from local parts so the assertion does not depend on the runner's timezone
  const t = new Date(2026, 8, 7, 9, 5).getTime();

  it("formats a date", () => {
    expect(formatDate(t, false)).toBe("2026-09-07");
  });

  it("adds zero-padded time when asked", () => {
    expect(formatDate(t, true)).toBe("2026-09-07 09:05");
  });
});
