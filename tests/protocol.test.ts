import { describe, expect, it } from "vitest";
import { parseGameMessage, parseShellMessage } from "../src/validation.js";

const game = (type: string, payload?: unknown, sessionId: string | null = "session-1") => ({
  protocol: "whs",
  version: 1,
  type,
  ...(sessionId === null ? {} : { sessionId }),
  ...(payload === undefined ? {} : { payload }),
});

describe("runtime protocol validation", () => {
  it.each([
    game("whs.game.ready", { gameId: "mock", capabilities: ["pause", "checkpoint"] }, null),
    game("whs.game.initialized"),
    game("whs.game.started"),
    game("whs.game.checkpoint", { checkpoint: "wave-2" }),
    game("whs.game.completed"),
    game("whs.game.completed", { score: 1250 }),
    game("whs.game.failed", { reason: "player-defeated" }),
    game("whs.game.error", { message: "bad state", code: "BAD_STATE" }),
    game("whs.game.event", { name: "obstacle_hit", properties: { obstacle: "cart", count: 1, fatal: false } }),
  ])("parses a valid game message", (message) => {
    expect(parseGameMessage(message)).toMatchObject({ ok: true });
  });

  it.each([
    game("whs.shell.initialize", { gameId: "mock", settings: { volume: 0.5, soundEnabled: true } }),
    game("whs.shell.start"),
    game("whs.shell.pause"),
    game("whs.shell.resume"),
    game("whs.shell.restart"),
    game("whs.shell.set-volume", { volume: 0 }),
  ])("parses a valid shell message", (message) => {
    expect(parseShellMessage(message)).toMatchObject({ ok: true });
  });

  it("accepts additive unknown fields", () => {
    expect(parseGameMessage({
      ...game("whs.game.completed", { score: 2, future: "ok" }),
      futureEnvelope: true,
    })).toMatchObject({ ok: true });
    expect(parseShellMessage(game("whs.shell.initialize", {
      gameId: "mock",
      settings: { volume: 0.5, soundEnabled: true, future: 1 },
      future: true,
    }))).toMatchObject({ ok: true });
  });

  it.each([
    null,
    [],
    { protocol: "other", version: 1, type: "whs.game.ready" },
    { protocol: "whs", version: 2, type: "whs.game.ready" },
    { protocol: "whs", version: 1 },
    game("whs.nope"),
  ])("rejects malformed envelopes and unsupported versions/types", (message) => {
    expect(parseGameMessage(message).ok).toBe(false);
  });

  it("rejects missing required game fields", () => {
    expect(parseGameMessage(game("whs.game.ready", { gameId: "mock" }, null)).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.ready", { gameId: "mock", capabilities: [] }, "stale")).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.initialized", undefined, null)).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.checkpoint", {})).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.failed", {})).ok).toBe(false);
  });

  it("rejects invalid capabilities, scores, event properties, and unexpected payloads", () => {
    expect(parseGameMessage(game("whs.game.ready", { gameId: "mock", capabilities: ["arbitrary"] }, null)).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.completed", { score: Number.NaN })).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.event", { name: "bad name", properties: { nested: {} } })).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.started", {})).ok).toBe(false);
  });

  it("rejects invalid shell payloads and missing sessions", () => {
    expect(parseShellMessage(game("whs.shell.initialize", { gameId: "mock", settings: { volume: 2, soundEnabled: true } })).ok).toBe(false);
    expect(parseShellMessage(game("whs.shell.start", undefined, null)).ok).toBe(false);
    expect(parseShellMessage(game("whs.shell.pause", {})).ok).toBe(false);
    expect(parseShellMessage(game("whs.shell.set-volume", { volume: -1 })).ok).toBe(false);
  });

  it("enforces the serialized message byte limit", () => {
    expect(parseGameMessage(game("whs.game.error", { message: "😀".repeat(3000) })).ok).toBe(false);
  });
});
