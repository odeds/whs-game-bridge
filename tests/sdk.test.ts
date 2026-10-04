import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameHost } from "../src/host.js";
import { createGameBridge } from "../src/game.js";

class FakeWindow {
  listeners = new Set<(event: MessageEvent) => void>(); posts: Array<{ data: unknown; origin: string }> = [];
  parent: FakeWindow = this;
  addEventListener(_type: string, fn: (event: MessageEvent) => void) { this.listeners.add(fn); }
  removeEventListener(_type: string, fn: (event: MessageEvent) => void) { this.listeners.delete(fn); }
  postMessage(data: unknown, origin: string) { this.posts.push({ data, origin }); }
  dispatch(data: unknown, origin: string, source: unknown) { this.listeners.forEach((fn) => fn({ data, origin, source } as MessageEvent)); }
}
let prior: unknown;
afterEach(() => { (globalThis as Record<string, unknown>).window = prior; vi.useRealTimers(); });
const msg = (type: string, sessionId?: string, payload?: unknown) => ({ protocol: "whs", version: 1, type, ...(sessionId ? { sessionId } : {}), ...(payload === undefined ? {} : { payload }) });

describe("host security and lifecycle", () => {
  it("rejects incorrect origin/source, duplicates, stale session and terminal messages", () => {
    const shell = new FakeWindow(); prior = (globalThis as Record<string, unknown>).window; (globalThis as Record<string, unknown>).window = shell;
    const game = new FakeWindow(); const iframe = { contentWindow: game } as unknown as HTMLIFrameElement;
    const host = createGameHost({ iframe, gameId: "g", expectedOrigin: "https://game.test" });
    shell.dispatch(msg("whs.game.ready", undefined, { gameId: "g", capabilities: [] }), "https://evil.test", game); expect(host.state).toBe("waiting");
    shell.dispatch(msg("whs.game.ready", undefined, { gameId: "g", capabilities: [] }), "https://game.test", new FakeWindow()); expect(host.state).toBe("waiting");
    shell.dispatch(msg("whs.game.ready", undefined, { gameId: "g", capabilities: [] }), "https://game.test", game); expect(host.state).toBe("initializing");
    shell.dispatch(msg("whs.game.ready", undefined, { gameId: "g", capabilities: [] }), "https://game.test", game); expect(game.posts).toHaveLength(1);
    shell.dispatch(msg("whs.game.initialized", "old"), "https://game.test", game); expect(host.state).toBe("initializing");
    shell.dispatch(msg("whs.game.initialized", host.sessionId), "https://game.test", game); expect(host.start()).toBe(true);
    shell.dispatch(msg("whs.game.completed", host.sessionId, { score: 1 }), "https://game.test", game); expect(host.state).toBe("completed");
    shell.dispatch(msg("whs.game.completed", host.sessionId, { score: 2 }), "https://game.test", game); expect(host.state).toBe("completed");
    shell.dispatch(msg("whs.game.checkpoint", host.sessionId, { checkpoint: "late" }), "https://game.test", game); expect(host.state).toBe("completed");
  });
  it("supports pause, resume, restart and handshake timeout", () => {
    vi.useFakeTimers(); const shell = new FakeWindow(); prior = (globalThis as Record<string, unknown>).window; (globalThis as Record<string, unknown>).window = shell; const game = new FakeWindow();
    const host = createGameHost({ iframe: { contentWindow: game } as unknown as HTMLIFrameElement, gameId: "g", expectedOrigin: "https://game.test", handshakeTimeoutMs: 5 });
    shell.dispatch(msg("whs.game.ready", undefined, { gameId: "g", capabilities: [] }), "https://game.test", game); shell.dispatch(msg("whs.game.initialized", host.sessionId), "https://game.test", game);
    host.start(); expect(host.pause()).toBe(true); expect(host.resume()).toBe(true); expect(host.restart()).toBe(true);
    const timed = createGameHost({ iframe: { contentWindow: game } as unknown as HTMLIFrameElement, gameId: "x", expectedOrigin: "https://game.test", handshakeTimeoutMs: 5 }); vi.advanceTimersByTime(5); expect(timed.state).toBe("timed-out");
  });
});

describe("game SDK", () => {
  it("requires matching parent origin/session and sends lifecycle events", async () => {
    const gameWindow = new FakeWindow(); const parent = new FakeWindow(); gameWindow.parent = parent; prior = (globalThis as Record<string, unknown>).window; (globalThis as Record<string, unknown>).window = gameWindow;
    const bridge = createGameBridge({ gameId: "g", parentOrigin: "https://shell.test" }); const ready = bridge.ready();
    gameWindow.dispatch(msg("whs.shell.initialize", "s", { gameId: "g", settings: { volume: 1, soundEnabled: true } }), "https://evil.test", parent); expect(bridge.state).toBe("ready");
    gameWindow.dispatch(msg("whs.shell.initialize", "s", { gameId: "g", settings: { volume: 1, soundEnabled: true } }), "https://shell.test", parent); await ready; bridge.started(); bridge.completed({ score: 3 }); bridge.completed({ score: 4 });
    expect(parent.posts.map((x) => (x.data as { type: string }).type)).toEqual(["whs.game.ready", "whs.game.initialized", "whs.game.started", "whs.game.completed"]);
  });
});
