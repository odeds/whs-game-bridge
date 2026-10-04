import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameBridge } from "../src/game.js";
import { createGameHost } from "../src/host.js";

class FakeWindow {
  listeners = new Set<(event: MessageEvent) => void>();
  posts: Array<{ data: unknown; origin: string }> = [];
  parent: FakeWindow = this;

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  postMessage(data: unknown, origin: string) {
    this.posts.push({ data, origin });
  }
  dispatch(data: unknown, origin: string, source: unknown) {
    this.listeners.forEach((listener) => listener({ data, origin, source } as MessageEvent));
  }
}

const originalWindow = globalThis.window;
afterEach(() => {
  (globalThis as { window: unknown }).window = originalWindow;
  vi.useRealTimers();
});

const message = (type: string, sessionId?: string, payload?: unknown) => ({
  protocol: "whs",
  version: 1,
  type,
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(payload === undefined ? {} : { payload }),
});

function useWindow(fake: FakeWindow) {
  (globalThis as { window: unknown }).window = fake;
}

function readyPayload(gameId = "game") {
  return { gameId, capabilities: ["pause", "restart", "checkpoint", "volume"] };
}

describe("host security and lifecycle", () => {
  it("requires the configured iframe source and origin", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
    });

    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://evil.test", game);
    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", new FakeWindow());

    expect(host.state).toBe("waiting");
    expect(game.posts).toHaveLength(0);
    host.destroy();
  });

  it("performs the handshake once and rejects stale sessions", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const received: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      onMessage: (incoming) => received.push(incoming.type),
    });

    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", game);
    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", game);
    expect(host.state).toBe("initializing");
    expect(game.posts).toHaveLength(1);
    expect(game.posts[0]?.origin).toBe("https://game.test");

    shell.dispatch(message("whs.game.initialized", "stale"), "https://game.test", game);
    expect(host.state).toBe("initializing");
    shell.dispatch(message("whs.game.initialized", host.sessionId), "https://game.test", game);
    expect(host.state).toBe("initialized");

    expect(host.start()).toBe(true);
    expect(host.state).toBe("starting");
    shell.dispatch(message("whs.game.completed", "stale", { score: 1 }), "https://game.test", game);
    expect(host.state).toBe("starting");
    shell.dispatch(message("whs.game.started", host.sessionId), "https://game.test", game);
    expect(host.state).toBe("started");
    expect(received).toEqual(["whs.game.ready", "whs.game.initialized", "whs.game.started"]);
    host.destroy();
  });

  it("ignores duplicate completion and every message after a terminal state", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const received: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      onMessage: (incoming) => received.push(incoming.type),
    });

    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", game);
    shell.dispatch(message("whs.game.initialized", host.sessionId), "https://game.test", game);
    host.start();
    shell.dispatch(message("whs.game.started", host.sessionId), "https://game.test", game);
    shell.dispatch(message("whs.game.completed", host.sessionId), "https://game.test", game);
    const acceptedCount = received.length;

    shell.dispatch(message("whs.game.completed", host.sessionId, { score: 2 }), "https://game.test", game);
    shell.dispatch(message("whs.game.checkpoint", host.sessionId, { checkpoint: "late" }), "https://game.test", game);
    shell.dispatch(message("whs.game.error", host.sessionId, { message: "late" }), "https://game.test", game);
    expect(host.state).toBe("completed");
    expect(received).toHaveLength(acceptedCount);
    host.destroy();
  });

  it("retains advertised capabilities through the handshake and supports their commands", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
    });

    shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", game);
    expect(host.capabilities).toEqual(["pause", "restart", "checkpoint", "volume"]);
    shell.dispatch(message("whs.game.initialized", host.sessionId), "https://game.test", game);
    host.start();
    shell.dispatch(message("whs.game.started", host.sessionId), "https://game.test", game);
    expect(host.pause()).toBe(true);
    expect(host.state).toBe("paused");
    expect(host.resume()).toBe(true);
    expect(host.state).toBe("started");

    const beforeVolume = game.posts.length;
    expect(host.setVolume(0.25)).toBe(true);
    expect(game.posts).toHaveLength(beforeVolume + 1);
    expect(host.setVolume(2)).toBe(false);
    expect(host.restart()).toBe(true);
    expect(host.state).toBe("initialized");
    host.destroy();
  });

  it("does not send commands or accept checkpoints that were not advertised", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const received: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      onMessage: (incoming) => received.push(incoming.type),
    });

    shell.dispatch(message("whs.game.ready", undefined, { gameId: "game", capabilities: [] }), "https://game.test", game);
    shell.dispatch(message("whs.game.initialized", host.sessionId), "https://game.test", game);
    host.start();
    shell.dispatch(message("whs.game.started", host.sessionId), "https://game.test", game);
    const postsBeforeOptionalCommands = game.posts.length;

    expect(host.pause()).toBe(false);
    expect(host.restart()).toBe(false);
    expect(host.setVolume(0.5)).toBe(false);
    expect(game.posts).toHaveLength(postsBeforeOptionalCommands);

    shell.dispatch(message("whs.game.checkpoint", host.sessionId, { checkpoint: "ignored" }), "https://game.test", game);
    expect(received).not.toContain("whs.game.checkpoint");
    host.destroy();
  });

  it("accepts checkpoints only when checkpoint was advertised", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const received: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      onMessage: (incoming) => received.push(incoming.type),
    });

    shell.dispatch(message("whs.game.ready", undefined, { gameId: "game", capabilities: ["checkpoint"] }), "https://game.test", game);
    shell.dispatch(message("whs.game.initialized", host.sessionId), "https://game.test", game);
    host.start();
    shell.dispatch(message("whs.game.started", host.sessionId), "https://game.test", game);
    shell.dispatch(message("whs.game.checkpoint", host.sessionId, { checkpoint: "wave-2" }), "https://game.test", game);
    expect(received).toContain("whs.game.checkpoint");
    host.destroy();
  });

  it.each(["waiting", "initializing"])("times out while %s", (phase) => {
    vi.useFakeTimers();
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const errors: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      handshakeTimeoutMs: 5,
      onProtocolError: (error) => errors.push(error),
    });
    if (phase === "initializing") {
      shell.dispatch(message("whs.game.ready", undefined, readyPayload()), "https://game.test", game);
    }

    vi.advanceTimersByTime(5);
    expect(host.state).toBe("timed-out");
    expect(errors).toEqual(["game initialization handshake timed out"]);
    host.destroy();
  });

  it("reports malformed trusted-source messages without changing state", () => {
    const shell = new FakeWindow();
    const game = new FakeWindow();
    useWindow(shell);
    const errors: string[] = [];
    const host = createGameHost({
      iframe: { contentWindow: game } as unknown as HTMLIFrameElement,
      gameId: "game",
      expectedOrigin: "https://game.test",
      onProtocolError: (error) => errors.push(error),
    });

    shell.dispatch({ protocol: "whs", version: 2, type: "whs.game.ready" }, "https://game.test", game);
    expect(host.state).toBe("waiting");
    expect(errors).toEqual(["unsupported protocol version"]);
    host.destroy();
  });
});

describe("game SDK", () => {
  it("requires the parent source, origin, game ID, and session", async () => {
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    const bridge = createGameBridge({ gameId: "game", parentOrigin: "https://shell.test" });
    const ready = bridge.ready();
    const initialize = message("whs.shell.initialize", "session", {
      gameId: "game",
      settings: { volume: 1, soundEnabled: true },
    });

    gameWindow.dispatch(initialize, "https://evil.test", parent);
    gameWindow.dispatch(initialize, "https://shell.test", new FakeWindow());
    gameWindow.dispatch({ ...initialize, payload: { gameId: "other", settings: { volume: 1, soundEnabled: true } } }, "https://shell.test", parent);
    expect(bridge.state).toBe("ready");

    gameWindow.dispatch(initialize, "https://shell.test", parent);
    await ready;
    expect(bridge.sessionId).toBe("session");
    expect(bridge.state).toBe("initialized");

    gameWindow.dispatch(message("whs.shell.start", "stale"), "https://shell.test", parent);
    expect(bridge.state).toBe("initialized");
    bridge.destroy();
  });

  it("accepts only valid lifecycle transitions and suppresses duplicates", async () => {
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    const callbacks = { start: 0, pause: 0, resume: 0, restart: 0 };
    const bridge = createGameBridge({
      gameId: "game",
      parentOrigin: "https://shell.test",
      capabilities: ["pause", "restart"],
    });
    bridge.onStart(() => callbacks.start++);
    bridge.onPause(() => callbacks.pause++);
    bridge.onResume(() => callbacks.resume++);
    bridge.onRestart(() => callbacks.restart++);
    const ready = bridge.ready();
    gameWindow.dispatch(message("whs.shell.initialize", "session", {
      gameId: "game",
      settings: { volume: 1, soundEnabled: true },
    }), "https://shell.test", parent);
    await ready;

    gameWindow.dispatch(message("whs.shell.pause", "session"), "https://shell.test", parent);
    expect(callbacks.pause).toBe(0);
    gameWindow.dispatch(message("whs.shell.start", "session"), "https://shell.test", parent);
    gameWindow.dispatch(message("whs.shell.start", "session"), "https://shell.test", parent);
    expect(callbacks.start).toBe(1);
    expect(bridge.state).toBe("starting");
    bridge.started();
    bridge.started();

    gameWindow.dispatch(message("whs.shell.pause", "session"), "https://shell.test", parent);
    gameWindow.dispatch(message("whs.shell.pause", "session"), "https://shell.test", parent);
    expect(callbacks.pause).toBe(1);
    gameWindow.dispatch(message("whs.shell.resume", "session"), "https://shell.test", parent);
    expect(callbacks.resume).toBe(1);

    bridge.completed();
    bridge.completed({ score: 2 });
    gameWindow.dispatch(message("whs.shell.restart", "session"), "https://shell.test", parent);
    expect(callbacks.restart).toBe(1);
    expect(bridge.state).toBe("initialized");
    expect(parent.posts.map((post) => (post.data as { type: string }).type)).toEqual([
      "whs.game.ready",
      "whs.game.initialized",
      "whs.game.started",
      "whs.game.completed",
    ]);
    bridge.destroy();
  });

  it("ignores unsupported optional commands and does not emit unsupported checkpoints", async () => {
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    const callbacks = { pause: 0, restart: 0, volume: 0 };
    const bridge = createGameBridge({ gameId: "game", parentOrigin: "https://shell.test" });
    bridge.onPause(() => callbacks.pause++);
    bridge.onRestart(() => callbacks.restart++);
    bridge.onSetVolume(() => callbacks.volume++);
    const ready = bridge.ready();
    gameWindow.dispatch(message("whs.shell.initialize", "session", {
      gameId: "game", settings: { volume: 1, soundEnabled: true },
    }), "https://shell.test", parent);
    await ready;
    gameWindow.dispatch(message("whs.shell.start", "session"), "https://shell.test", parent);
    bridge.started();
    const postCount = parent.posts.length;

    gameWindow.dispatch(message("whs.shell.pause", "session"), "https://shell.test", parent);
    gameWindow.dispatch(message("whs.shell.restart", "session"), "https://shell.test", parent);
    gameWindow.dispatch(message("whs.shell.set-volume", "session", { volume: 0.5 }), "https://shell.test", parent);
    bridge.checkpoint({ checkpoint: "not-supported" });
    expect(callbacks).toEqual({ pause: 0, restart: 0, volume: 0 });
    expect(bridge.state).toBe("started");
    expect(parent.posts).toHaveLength(postCount);
    bridge.destroy();
  });

  it("emits checkpoints when checkpoint was advertised", async () => {
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    const bridge = createGameBridge({
      gameId: "game", parentOrigin: "https://shell.test", capabilities: ["checkpoint"],
    });
    const ready = bridge.ready();
    gameWindow.dispatch(message("whs.shell.initialize", "session", {
      gameId: "game", settings: { volume: 1, soundEnabled: true },
    }), "https://shell.test", parent);
    await ready;
    gameWindow.dispatch(message("whs.shell.start", "session"), "https://shell.test", parent);
    bridge.started();
    bridge.checkpoint({ checkpoint: "wave-2" });
    expect(parent.posts.at(-1)?.data).toMatchObject({ type: "whs.game.checkpoint" });
    bridge.destroy();
  });

  it("times out and ignores late initialization", async () => {
    vi.useFakeTimers();
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    const bridge = createGameBridge({
      gameId: "game",
      parentOrigin: "https://shell.test",
      handshakeTimeoutMs: 5,
    });
    const ready = bridge.ready();
    vi.advanceTimersByTime(5);
    await expect(ready).rejects.toThrow("timed out");
    expect(bridge.state).toBe("timed-out");

    gameWindow.dispatch(message("whs.shell.initialize", "session", {
      gameId: "game",
      settings: { volume: 1, soundEnabled: true },
    }), "https://shell.test", parent);
    expect(bridge.state).toBe("timed-out");
    bridge.destroy();
  });

  it("runtime-validates SDK options and outbound telemetry", async () => {
    const gameWindow = new FakeWindow();
    const parent = new FakeWindow();
    gameWindow.parent = parent;
    useWindow(gameWindow);
    expect(() => createGameBridge({
      gameId: "game",
      parentOrigin: "*",
    })).toThrow();

    const bridge = createGameBridge({ gameId: "game", parentOrigin: "https://shell.test" });
    const ready = bridge.ready();
    gameWindow.dispatch(message("whs.shell.initialize", "session", {
      gameId: "game",
      settings: { volume: 1, soundEnabled: true },
    }), "https://shell.test", parent);
    await ready;
    expect(() => bridge.event({ name: "bad name" })).toThrow("invalid event payload");
    bridge.destroy();
  });
});
