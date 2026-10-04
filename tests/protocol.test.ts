import { describe, expect, it } from "vitest";
import { parseGameMessage, parseShellMessage } from "../src/validation.js";
const game = (type: string, payload?: unknown, sessionId = "session-1") => ({ protocol: "whs", version: 1, type, sessionId, ...(payload === undefined ? {} : { payload }) });

describe("runtime protocol validation", () => {
  it("parses valid messages and ignores unknown optional fields", () => {
    const result = parseGameMessage({ ...game("whs.game.completed", { score: 2, future: "ok" }), futureEnvelope: true });
    expect(result.ok).toBe(true);
    expect(parseShellMessage(game("whs.shell.initialize", { gameId: "mock", settings: { volume: .5, soundEnabled: true, future: 1 } }))).toMatchObject({ ok: true });
  });
  it("rejects malformed messages, bad types, missing fields, and versions", () => {
    expect(parseGameMessage(null).ok).toBe(false);
    expect(parseGameMessage({ protocol: "whs", version: 2, type: "whs.game.ready" }).ok).toBe(false);
    expect(parseGameMessage(game("whs.nope")).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.ready", { gameId: "x" })).ok).toBe(false);
    expect(parseGameMessage(game("whs.game.event", { name: "bad name", properties: { x: {} } })).ok).toBe(false);
    expect(parseShellMessage(game("whs.shell.set-volume", { volume: 2 })).ok).toBe(false);
  });
});
