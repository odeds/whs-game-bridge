import {
  PROTOCOL,
  PROTOCOL_VERSION,
  hasGameCapability,
  type GameCapability,
  type GameMessage,
  type InitializePayload,
  type ShellMessage,
} from "./protocol.js";
import { parseGameMessage, parseShellMessage } from "./validation.js";

export type HostState =
  | "waiting"
  | "initializing"
  | "initialized"
  | "starting"
  | "started"
  | "paused"
  | "completed"
  | "failed"
  | "timed-out"
  | "destroyed";

export interface GameHostOptions {
  iframe: HTMLIFrameElement;
  gameId: string;
  expectedOrigin: string;
  settings?: InitializePayload["settings"];
  handshakeTimeoutMs?: number;
  onMessage?: (message: GameMessage) => void;
  onStateChange?: (state: HostState) => void;
  onProtocolError?: (reason: string) => void;
}

export interface GameHost {
  readonly state: HostState;
  /** Optional behaviors advertised in the accepted whs.game.ready message. */
  readonly capabilities: readonly GameCapability[];
  readonly sessionId: string;
  start(): boolean;
  pause(): boolean;
  resume(): boolean;
  restart(): boolean;
  setVolume(volume: number): boolean;
  destroy(): void;
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin === "null") {
    throw new Error("expectedOrigin must be an HTTP(S) origin");
  }
  return url.origin;
}

function randomSession(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("secure random session IDs require Web Crypto");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timeoutMs(value: number | undefined): number {
  if (value === undefined) return 10000;
  if (!Number.isFinite(value) || value < 0) throw new Error("handshakeTimeoutMs must be non-negative");
  return value;
}

export function createGameHost(options: GameHostOptions): GameHost {
  if (!options.gameId || !options.expectedOrigin || options.expectedOrigin === "*") {
    throw new Error("gameId and explicit expectedOrigin are required");
  }

  const expectedOrigin = normalizeOrigin(options.expectedOrigin);
  const sessionId = randomSession();
  const settings = options.settings ?? { volume: 1, soundEnabled: true };
  const handshakeTimeoutMs = timeoutMs(options.handshakeTimeoutMs);
  const initializeMessage = {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    type: "whs.shell.initialize",
    sessionId,
    payload: { gameId: options.gameId, settings },
  } as const;
  const validInitialize = parseShellMessage(initializeMessage);
  if (!validInitialize.ok) throw new Error(validInitialize.error);

  let current: HostState = "waiting";
  let capabilities: readonly GameCapability[] = [];
  const setState = (state: HostState) => {
    current = state;
    options.onStateChange?.(state);
  };

  const post = (type: ShellMessage["type"], payload?: unknown) => {
    const target = options.iframe.contentWindow;
    if (!target) return false;
    const candidate = {
      protocol: PROTOCOL,
      version: PROTOCOL_VERSION,
      type,
      sessionId,
      ...(payload === undefined ? {} : { payload }),
    };
    const parsed = parseShellMessage(candidate);
    if (!parsed.ok) throw new TypeError(parsed.error);
    target.postMessage(parsed.value, expectedOrigin);
    return true;
  };

  const timeout = setTimeout(() => {
    if (current !== "waiting" && current !== "initializing") return;
    setState("timed-out");
    options.onProtocolError?.("game initialization handshake timed out");
  }, handshakeTimeoutMs);

  const listener = (event: MessageEvent) => {
    if (event.source !== options.iframe.contentWindow || event.origin !== expectedOrigin) return;

    const parsed = parseGameMessage(event.data);
    if (!parsed.ok) {
      options.onProtocolError?.(parsed.error);
      return;
    }
    const message = parsed.value;

    if (message.type === "whs.game.ready") {
      if (current !== "waiting" || message.payload.gameId !== options.gameId) return;
      capabilities = Object.freeze([...new Set(message.payload.capabilities)]);
      if (!post("whs.shell.initialize", initializeMessage.payload)) return;
      setState("initializing");
      options.onMessage?.(message);
      return;
    }

    if (
      message.sessionId !== sessionId ||
      current === "timed-out" ||
      current === "destroyed" ||
      current === "completed" ||
      current === "failed"
    ) return;

    switch (message.type) {
      case "whs.game.initialized":
        if (current !== "initializing") return;
        clearTimeout(timeout);
        setState("initialized");
        break;
      case "whs.game.started":
        if (current !== "starting") return;
        setState("started");
        break;
      case "whs.game.checkpoint":
        if (!hasGameCapability(capabilities, "checkpoint") || (current !== "started" && current !== "paused")) return;
        break;
      case "whs.game.completed":
        if (current !== "started" && current !== "paused") return;
        setState("completed");
        break;
      case "whs.game.failed":
        if (current !== "started" && current !== "paused") return;
        setState("failed");
        break;
      case "whs.game.error":
      case "whs.game.event":
        if (!["initialized", "starting", "started", "paused"].includes(current)) return;
        break;
    }
    options.onMessage?.(message);
  };

  window.addEventListener("message", listener);

  const action = (
    type: ShellMessage["type"],
    permitted: HostState[],
    capability?: GameCapability,
  ) => permitted.includes(current) && (!capability || hasGameCapability(capabilities, capability)) && post(type);

  return {
    get state() { return current; },
    get capabilities() { return capabilities; },
    sessionId,
    start() {
      if (!action("whs.shell.start", ["initialized"])) return false;
      setState("starting");
      return true;
    },
    pause() {
      if (!action("whs.shell.pause", ["started"], "pause")) return false;
      setState("paused");
      return true;
    },
    resume() {
      if (!action("whs.shell.resume", ["paused"], "pause")) return false;
      setState("started");
      return true;
    },
    restart() {
      if (!action("whs.shell.restart", ["initialized", "starting", "started", "paused", "completed", "failed"], "restart")) {
        return false;
      }
      setState("initialized");
      return true;
    },
    setVolume(volume) {
      if (!Number.isFinite(volume) || volume < 0 || volume > 1) return false;
      if (!["initialized", "starting", "started", "paused"].includes(current)) return false;
      if (!hasGameCapability(capabilities, "volume")) return false;
      return post("whs.shell.set-volume", { volume });
    },
    destroy() {
      if (current === "destroyed") return;
      clearTimeout(timeout);
      window.removeEventListener("message", listener);
      setState("destroyed");
    },
  };
}
