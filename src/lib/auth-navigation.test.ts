import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredAuthDestination,
  readStoredAuthDestination,
  safeAuthDestination,
  storeAuthDestination,
} from "./auth-navigation";

describe("auth navigation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each([
    [null, "/dashboard"],
    ["https://attacker.example", "/dashboard"],
    ["//attacker.example", "/dashboard"],
    ["/%5Cattacker.example", "/dashboard"],
    ["%E0%A4%A", "/dashboard"],
    ["/library/123?tab=posts", "/library/123?tab=posts"],
  ])("maps %s to a safe same-origin destination", (raw, expected) => {
    expect(safeAuthDestination(raw)).toBe(expected);
  });

  it("reads and clears the stored destination", () => {
    storeAuthDestination("/performance");
    expect(readStoredAuthDestination()).toBe("/performance");
    clearStoredAuthDestination();
    expect(readStoredAuthDestination()).toBe("/dashboard");
  });
});