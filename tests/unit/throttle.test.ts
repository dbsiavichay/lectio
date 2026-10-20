import { describe, expect, it } from "vitest";

import { LoginThrottle } from "@/lib/auth/throttle";

describe("LoginThrottle", () => {
  const minutes = (n: number) => n * 60_000;

  it("locks a key after five failures and unlocks after the lock time", () => {
    let now = 0;
    const throttle = new LoginThrottle(5, minutes(15), minutes(15), () => now);
    for (let i = 0; i < 4; i++) throttle.fail("ip:1", "user:denis");
    expect(throttle.lockedFor("ip:1", "user:denis")).toBe(0);
    throttle.fail("ip:1", "user:denis");
    expect(throttle.lockedFor("user:denis")).toBe(minutes(15));
    now = minutes(16);
    expect(throttle.lockedFor("ip:1", "user:denis")).toBe(0);
  });

  it("forgets failures older than the window", () => {
    let now = 0;
    const throttle = new LoginThrottle(3, minutes(15), minutes(15), () => now);
    throttle.fail("user:a");
    throttle.fail("user:a");
    now = minutes(20);
    throttle.fail("user:a");
    expect(throttle.lockedFor("user:a")).toBe(0);
  });

  it("clears the count after a successful login", () => {
    const throttle = new LoginThrottle(2, minutes(15), minutes(15), () => 0);
    throttle.fail("user:a");
    throttle.succeed("user:a");
    throttle.fail("user:a");
    expect(throttle.lockedFor("user:a")).toBe(0);
  });

  it("locks by IP even when the attacker rotates usernames", () => {
    const throttle = new LoginThrottle(3, minutes(15), minutes(15), () => 0);
    for (const name of ["a", "b", "c"]) throttle.fail("ip:9", `user:${name}`);
    expect(throttle.lockedFor("ip:9", "user:z")).toBeGreaterThan(0);
  });
});
