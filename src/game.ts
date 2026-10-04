import {
  PROTOCOL,
  PROTOCOL_VERSION,
  type CheckpointPayload,
  type CompletedPayload,
  type ErrorPayload,
  type EventPayload,
  type FailedPayload,
  hasGameCapability,
  type GameCapabilities,
  type GameMessage,
  type ShellMessage,
} from "./protocol.js";
import { parseGameMessage, parseShellMessage } from "./validation.js";

export type GameState =
  | "new"
  | "ready"
  | "initialized"
  | "starting"
  | "started"
  | "paused"
  | "completed"
  | "failed"
  | "timed-out"
  | "destroyed";

export interface GameBridgeOptions {
  gameId: string;
  parentOrigin: string;
  capabilities?: GameCapabilities;
  handshakeTimeoutMs?: number;
}

export interface GameBridge {
  readonly state: GameState;
  readonly sessionId?: string;
  ready(): Promise<void>;
  started(): void;
  checkpoint(payload: CheckpointPayload): void;
  completed(payload?: CompletedPayload): void;
  failed(payload: FailedPayload): void;
  error(payload: ErrorPayload): void;
  event(payload: EventPayload): void;
  onInitialize(callback: (message: Extract<ShellMessage, { type: "whs.shell.initialize" }>) => void): () => void;
  onStart(callback: () => void): () => void;
  onPause(callback: () => void): () => void;
  onResume(callback: () => void): () => void;
  onRestart(callback: () => void): () => void;
  onSetVolume(callback: (volume: number) => void): () => void;
  destroy(): void;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin === "null") {
    throw new Error("parentOrigin must be an HTTP(S) origin");
  }
  return url.origin;
}

function timeoutMs(value: number | undefined): number {
  if (value === undefined) return 10000;
  if (!Number.isFinite(value) || value < 0) throw new Error("handshakeTimeoutMs must be non-negative");
  return value;
}

export function createGameBridge(options: GameBridgeOptions): GameBridge {
  if (!options.gameId || !options.parentOrigin || options.parentOrigin === "*") {
    throw new Error("gameId and explicit parentOrigin are required");
  }

  const parentOrigin = normalizeOrigin(options.parentOrigin);
  const handshakeTimeoutMs = timeoutMs(options.handshakeTimeoutMs);
  const capabilities = [...new Set(options.capabilities ?? [])];
  const readyMessage = {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    type: "whs.game.ready",
    payload: { gameId: options.gameId, capabilities },
  } as const;
  const validReady = parseGameMessage(readyMessage);
  if (!validReady.ok) throw new Error(validReady.error);

  let current: GameState = "new";
  let sessionId: string | undefined;
  let readyPromise: Promise<void> | undefined;
  let resolveReady: (() => void) | undefined;
  let rejectReady: ((reason: Error) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const callbacks = new Map<string, Set<(message: ShellMessage) => void>>();

  const emit = (type: GameMessage["type"], payload?: unknown) => {
    const candidate = {
      protocol: PROTOCOL,
      version: PROTOCOL_VERSION,
      type,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(payload === undefined ? {} : { payload }),
    };
    const parsed = parseGameMessage(candidate);
    if (!parsed.ok) throw new TypeError(parsed.error);
    window.parent.postMessage(parsed.value, parentOrigin);
  };

  const notify = (message: ShellMessage) => {
    callbacks.get(message.type)?.forEach((callback) => callback(message));
  };

  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;

    const parsed = parseShellMessage(event.data);
    if (!parsed.ok) return;
    const message = parsed.value;

    if (message.type === "whs.shell.initialize") {
      if (current !== "ready" || message.payload.gameId !== options.gameId) return;
      sessionId = message.sessionId;
      emit("whs.game.initialized");
      current = "initialized";
      clearTimeout(timer);
      resolveReady?.();
      notify(message);
      return;
    }

    if (!sessionId || message.sessionId !== sessionId || current === "destroyed" || current === "timed-out") {
      return;
    }

    switch (message.type) {
      case "whs.shell.start":
        if (current !== "initialized") return;
        current = "starting";
        break;
      case "whs.shell.pause":
        if (!hasGameCapability(capabilities, "pause") || current !== "started") return;
        current = "paused";
        break;
      case "whs.shell.resume":
        if (!hasGameCapability(capabilities, "pause") || current !== "paused") return;
        current = "started";
        break;
      case "whs.shell.restart":
        if (!hasGameCapability(capabilities, "restart") || !["initialized", "starting", "started", "paused", "completed", "failed"].includes(current)) return;
        current = "initialized";
        break;
      case "whs.shell.set-volume":
        if (!hasGameCapability(capabilities, "volume") || !["initialized", "starting", "started", "paused"].includes(current)) return;
        break;
    }
    notify(message);
  };

  window.addEventListener("message", listener);

  const on = (type: ShellMessage["type"], callback: (message: ShellMessage) => void) => {
    const registered = callbacks.get(type) ?? new Set();
    registered.add(callback);
    callbacks.set(type, registered);
    return () => registered.delete(callback);
  };

  return {
    get state() { return current; },
    get sessionId() { return sessionId; },
    ready() {
      if (readyPromise) return readyPromise;
      if (current !== "new") return Promise.reject(new Error("game bridge cannot become ready in its current state"));

      current = "ready";
      readyPromise = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      emit("whs.game.ready", readyMessage.payload);
      timer = setTimeout(() => {
        if (current !== "ready") return;
        current = "timed-out";
        rejectReady?.(new Error("WHS initialization timed out"));
      }, handshakeTimeoutMs);
      return readyPromise;
    },
    started() {
      if (current !== "starting") return;
      emit("whs.game.started");
      current = "started";
    },
    checkpoint(payload) {
      if (hasGameCapability(capabilities, "checkpoint") && (current === "started" || current === "paused")) {
        emit("whs.game.checkpoint", payload);
      }
    },
    completed(payload) {
      if (current !== "started" && current !== "paused") return;
      emit("whs.game.completed", payload);
      current = "completed";
    },
    failed(payload) {
      if (current !== "started" && current !== "paused") return;
      emit("whs.game.failed", payload);
      current = "failed";
    },
    error(payload) {
      if (sessionId && ["initialized", "starting", "started", "paused"].includes(current)) {
        emit("whs.game.error", payload);
      }
    },
    event(payload) {
      if (sessionId && ["initialized", "starting", "started", "paused"].includes(current)) {
        emit("whs.game.event", payload);
      }
    },
    onInitialize(callback) {
      return on("whs.shell.initialize", callback as (message: ShellMessage) => void);
    },
    onStart(callback) { return on("whs.shell.start", () => callback()); },
    onPause(callback) { return on("whs.shell.pause", () => callback()); },
    onResume(callback) { return on("whs.shell.resume", () => callback()); },
    onRestart(callback) { return on("whs.shell.restart", () => callback()); },
    onSetVolume(callback) {
      return on("whs.shell.set-volume", (message) => {
        if (message.type === "whs.shell.set-volume") callback(message.payload.volume);
      });
    },
    destroy() {
      if (current === "destroyed") return;
      current = "destroyed";
      clearTimeout(timer);
      window.removeEventListener("message", listener);
      callbacks.clear();
      rejectReady?.(new Error("game bridge destroyed before initialization"));
    },
  };
}
