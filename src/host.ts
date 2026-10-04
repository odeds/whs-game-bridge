import { PROTOCOL, PROTOCOL_VERSION, type GameMessage, type InitializePayload } from "./protocol.js";
import { parseGameMessage } from "./validation.js";

export type HostState = "waiting" | "initializing" | "initialized" | "started" | "paused" | "completed" | "failed" | "timed-out" | "destroyed";
export interface GameHostOptions {
  iframe: HTMLIFrameElement; gameId: string; expectedOrigin: string;
  settings?: InitializePayload["settings"]; handshakeTimeoutMs?: number;
  onMessage?: (message: GameMessage) => void; onStateChange?: (state: HostState) => void; onProtocolError?: (reason: string) => void;
}
export interface GameHost {
  readonly state: HostState; readonly sessionId: string;
  start(): boolean; pause(): boolean; resume(): boolean; restart(): boolean; setVolume(volume: number): boolean; destroy(): void;
}
const normalizedOrigin = (value: string) => new URL(value).origin;
const randomSession = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error("secure random session IDs require Web Crypto");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export function createGameHost(options: GameHostOptions): GameHost {
  if (!options.gameId || !options.expectedOrigin || options.expectedOrigin === "*") throw new Error("gameId and explicit expectedOrigin are required");
  const expectedOrigin = normalizedOrigin(options.expectedOrigin); const sessionId = randomSession(); let current: HostState = "waiting";
  const set = (state: HostState) => { current = state; options.onStateChange?.(state); };
  const post = (type: string, payload?: unknown) => {
    const target = options.iframe.contentWindow; if (!target) return false;
    target.postMessage({ protocol: PROTOCOL, version: PROTOCOL_VERSION, type, sessionId, ...(payload === undefined ? {} : { payload }) }, expectedOrigin); return true;
  };
  const timeout = setTimeout(() => { if (current === "waiting") { set("timed-out"); options.onProtocolError?.("game ready handshake timed out"); } }, options.handshakeTimeoutMs ?? 10000);
  const listener = (event: MessageEvent) => {
    if (event.source !== options.iframe.contentWindow || event.origin !== expectedOrigin) return;
    const parsed = parseGameMessage(event.data); if (!parsed.ok) { options.onProtocolError?.(parsed.error); return; }
    const message = parsed.value;
    if (message.type === "whs.game.ready") {
      if (current !== "waiting" || message.payload!.gameId !== options.gameId) return;
      set("initializing"); post("whs.shell.initialize", { gameId: options.gameId, settings: options.settings ?? { volume: 1, soundEnabled: true } }); options.onMessage?.(message); return;
    }
    if (message.sessionId !== sessionId || current === "timed-out" || current === "destroyed") return;
    if (message.type === "whs.game.initialized") { if (current !== "initializing") return; set("initialized"); clearTimeout(timeout); }
    else if (message.type === "whs.game.started") { if (current !== "started") return; }
    else if (message.type === "whs.game.checkpoint") { if (current !== "started" && current !== "paused") return; }
    else if (message.type === "whs.game.completed") { if (current !== "started" && current !== "paused") return; set("completed"); }
    else if (message.type === "whs.game.failed") { if (current !== "started" && current !== "paused") return; set("failed"); }
    options.onMessage?.(message);
  };
  window.addEventListener("message", listener);
  const action = (type: string, permitted: HostState[]) => permitted.includes(current) && post(type);
  return {
    get state() { return current; }, sessionId,
    start() { if (!action("whs.shell.start", ["initialized"])) return false; set("started"); return true; },
    pause() { if (!action("whs.shell.pause", ["started"])) return false; set("paused"); return true; },
    resume() { if (!action("whs.shell.resume", ["paused"])) return false; set("started"); return true; },
    restart() { if (!action("whs.shell.restart", ["initialized", "started", "paused", "completed", "failed"])) return false; set("initialized"); return true; },
    setVolume(volume) { return Number.isFinite(volume) && volume >= 0 && volume <= 1 && ["initialized", "started", "paused"].includes(current) && post("whs.shell.set-volume", { volume }); },
    destroy() { set("destroyed"); clearTimeout(timeout); window.removeEventListener("message", listener); },
  };
}
