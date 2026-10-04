import { PROTOCOL, PROTOCOL_VERSION, type CheckpointPayload, type CompletedPayload, type ErrorPayload, type EventPayload, type FailedPayload, type GameCapability, type ShellMessage } from "./protocol.js";
import { parseShellMessage } from "./validation.js";

export type GameState = "new" | "ready" | "initialized" | "started" | "paused" | "completed" | "failed" | "destroyed";
export interface GameBridgeOptions { gameId: string; parentOrigin: string; capabilities?: GameCapability[]; handshakeTimeoutMs?: number }
export interface GameBridge {
  readonly state: GameState; readonly sessionId?: string;
  ready(): Promise<void>; started(): void; checkpoint(payload: CheckpointPayload): void;
  completed(payload?: CompletedPayload): void; failed(payload: FailedPayload): void; error(payload: ErrorPayload): void; event(payload: EventPayload): void;
  onInitialize(callback: (message: Extract<ShellMessage, { type: "whs.shell.initialize" }>) => void): () => void;
  onStart(callback: () => void): () => void; onPause(callback: () => void): () => void; onResume(callback: () => void): () => void;
  onRestart(callback: () => void): () => void; onSetVolume(callback: (volume: number) => void): () => void; destroy(): void;
}
const origin = (value: string) => new URL(value).origin;

export function createGameBridge(options: GameBridgeOptions): GameBridge {
  if (!options.gameId || !options.parentOrigin || options.parentOrigin === "*") throw new Error("gameId and explicit parentOrigin are required");
  const parentOrigin = origin(options.parentOrigin); let current: GameState = "new"; let sid: string | undefined;
  const callbacks = new Map<string, Set<(m: ShellMessage) => void>>(); let readyPromise: Promise<void> | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = (type: string, payload?: unknown) => window.parent.postMessage({ protocol: PROTOCOL, version: PROTOCOL_VERSION, type, sessionId: sid, ...(payload === undefined ? {} : { payload }) }, parentOrigin);
  const allowed = () => current !== "destroyed" && current !== "completed" && current !== "failed";
  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const parsed = parseShellMessage(event.data); if (!parsed.ok) return; const message = parsed.value;
    if (message.type === "whs.shell.initialize") {
      if (message.payload!.gameId !== options.gameId || current !== "ready") return;
      sid = message.sessionId; current = "initialized"; emit("whs.game.initialized"); clearTimeout(timer);
      callbacks.get(message.type)?.forEach((fn) => fn(message)); return;
    }
    if (!sid || message.sessionId !== sid || current === "destroyed") return;
    if (message.type === "whs.shell.restart") { current = "initialized"; callbacks.get(message.type)?.forEach((fn) => fn(message)); return; }
    if (!allowed()) return;
    if (message.type === "whs.shell.pause" && current === "started") current = "paused";
    if (message.type === "whs.shell.resume" && current === "paused") current = "started";
    callbacks.get(message.type)?.forEach((fn) => fn(message));
  };
  window.addEventListener("message", listener);
  const on = (type: string, callback: (m: ShellMessage) => void) => { const set = callbacks.get(type) ?? new Set(); set.add(callback); callbacks.set(type, set); return () => set.delete(callback); };
  return {
    get state() { return current; }, get sessionId() { return sid; },
    ready() { if (readyPromise) return readyPromise; current = "ready"; emit("whs.game.ready", { gameId: options.gameId, capabilities: options.capabilities ?? [] }); readyPromise = new Promise((resolve, reject) => { on("whs.shell.initialize", () => resolve()); timer = setTimeout(() => { if (current === "ready") reject(new Error("WHS initialization timed out")); }, options.handshakeTimeoutMs ?? 10000); }); return readyPromise; },
    started() { if (current === "initialized") { current = "started"; emit("whs.game.started"); } },
    checkpoint(payload) { if (current === "started" || current === "paused") emit("whs.game.checkpoint", payload); },
    completed(payload = {}) { if (allowed() && (current === "started" || current === "paused")) { current = "completed"; emit("whs.game.completed", payload); } },
    failed(payload) { if (current === "started" || current === "paused") { current = "failed"; emit("whs.game.failed", payload); } },
    error(payload) { if (allowed() && sid) emit("whs.game.error", payload); },
    event(payload) { if (allowed() && sid) emit("whs.game.event", payload); },
    onInitialize(callback) { return on("whs.shell.initialize", callback as (m: ShellMessage) => void); },
    onStart(callback) { return on("whs.shell.start", () => callback()); }, onPause(callback) { return on("whs.shell.pause", () => callback()); }, onResume(callback) { return on("whs.shell.resume", () => callback()); }, onRestart(callback) { return on("whs.shell.restart", () => callback()); }, onSetVolume(callback) { return on("whs.shell.set-volume", (m) => callback((m as Extract<ShellMessage, { type: "whs.shell.set-volume" }>).payload!.volume)); },
    destroy() { current = "destroyed"; clearTimeout(timer); window.removeEventListener("message", listener); callbacks.clear(); },
  };
}
