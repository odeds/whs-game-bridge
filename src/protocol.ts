export const PROTOCOL = "whs" as const;
export const PROTOCOL_VERSION = 1 as const;

export type GameCapability = "pause" | "restart" | "checkpoint" | "volume";
export type GameMessageType =
  | "whs.game.ready" | "whs.game.initialized" | "whs.game.started"
  | "whs.game.checkpoint" | "whs.game.completed" | "whs.game.failed"
  | "whs.game.error" | "whs.game.event";
export type ShellMessageType =
  | "whs.shell.initialize" | "whs.shell.start" | "whs.shell.pause"
  | "whs.shell.resume" | "whs.shell.restart" | "whs.shell.set-volume";
export type MessageType = GameMessageType | ShellMessageType;

export interface Envelope<T = unknown> {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  type: MessageType;
  sessionId?: string;
  payload?: T;
}
export interface ReadyPayload { gameId: string; capabilities: GameCapability[] }
export interface InitializePayload {
  gameId: string;
  settings: { volume: number; soundEnabled: boolean };
}
export interface CheckpointPayload { checkpoint: string }
export interface CompletedPayload { score?: number }
export interface FailedPayload { reason: string }
export interface ErrorPayload { message: string; code?: string }
export type EventProperties = Record<string, string | number | boolean>;
export interface EventPayload { name: string; properties?: EventProperties }
export interface VolumePayload { volume: number }

export type GameMessage =
  | Envelope<ReadyPayload> & { type: "whs.game.ready" }
  | Envelope & { type: "whs.game.initialized" | "whs.game.started" }
  | Envelope<CheckpointPayload> & { type: "whs.game.checkpoint" }
  | Envelope<CompletedPayload> & { type: "whs.game.completed" }
  | Envelope<FailedPayload> & { type: "whs.game.failed" }
  | Envelope<ErrorPayload> & { type: "whs.game.error" }
  | Envelope<EventPayload> & { type: "whs.game.event" };
export type ShellMessage =
  | Envelope<InitializePayload> & { type: "whs.shell.initialize"; sessionId: string }
  | Envelope & { type: "whs.shell.start" | "whs.shell.pause" | "whs.shell.resume" | "whs.shell.restart"; sessionId: string }
  | Envelope<VolumePayload> & { type: "whs.shell.set-volume"; sessionId: string };

export const gameMessageTypes: readonly GameMessageType[] = [
  "whs.game.ready", "whs.game.initialized", "whs.game.started", "whs.game.checkpoint",
  "whs.game.completed", "whs.game.failed", "whs.game.error", "whs.game.event",
];
export const shellMessageTypes: readonly ShellMessageType[] = [
  "whs.shell.initialize", "whs.shell.start", "whs.shell.pause", "whs.shell.resume",
  "whs.shell.restart", "whs.shell.set-volume",
];
