export const PROTOCOL = "whs" as const;
export const PROTOCOL_VERSION = 1 as const;

export const gameCapabilities = ["pause", "restart", "checkpoint", "volume"] as const;
export type GameCapability = (typeof gameCapabilities)[number];
export type GameCapabilities = readonly GameCapability[];

/** Returns whether a game advertised an optional Protocol v1 behavior. */
export function hasGameCapability(capabilities: GameCapabilities, capability: GameCapability): boolean {
  return capabilities.includes(capability);
}
export type GameMessageType =
  | "whs.game.ready"
  | "whs.game.initialized"
  | "whs.game.started"
  | "whs.game.checkpoint"
  | "whs.game.completed"
  | "whs.game.failed"
  | "whs.game.error"
  | "whs.game.event";
export type ShellMessageType =
  | "whs.shell.initialize"
  | "whs.shell.start"
  | "whs.shell.pause"
  | "whs.shell.resume"
  | "whs.shell.restart"
  | "whs.shell.set-volume";
export type MessageType = GameMessageType | ShellMessageType;

export interface Envelope<T = unknown> {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  type: MessageType;
  sessionId?: string;
  payload?: T;
}

export interface ReadyPayload {
  gameId: string;
  capabilities: GameCapabilities;
}
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

type Message<TType extends MessageType> = {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  type: TType;
};
type SessionMessage<TType extends MessageType> = Message<TType> & { sessionId: string };
type PayloadMessage<TType extends MessageType, TPayload> = Message<TType> & { payload: TPayload };
type SessionPayloadMessage<TType extends MessageType, TPayload> = SessionMessage<TType> & { payload: TPayload };

export type GameMessage =
  | PayloadMessage<"whs.game.ready", ReadyPayload>
  | SessionMessage<"whs.game.initialized" | "whs.game.started">
  | SessionPayloadMessage<"whs.game.checkpoint", CheckpointPayload>
  | SessionMessage<"whs.game.completed"> & { payload?: CompletedPayload }
  | SessionPayloadMessage<"whs.game.failed", FailedPayload>
  | SessionPayloadMessage<"whs.game.error", ErrorPayload>
  | SessionPayloadMessage<"whs.game.event", EventPayload>;

export type ShellMessage =
  | SessionPayloadMessage<"whs.shell.initialize", InitializePayload>
  | SessionMessage<"whs.shell.start" | "whs.shell.pause" | "whs.shell.resume" | "whs.shell.restart">
  | SessionPayloadMessage<"whs.shell.set-volume", VolumePayload>;

export const gameMessageTypes: readonly GameMessageType[] = [
  "whs.game.ready",
  "whs.game.initialized",
  "whs.game.started",
  "whs.game.checkpoint",
  "whs.game.completed",
  "whs.game.failed",
  "whs.game.error",
  "whs.game.event",
];
export const shellMessageTypes: readonly ShellMessageType[] = [
  "whs.shell.initialize",
  "whs.shell.start",
  "whs.shell.pause",
  "whs.shell.resume",
  "whs.shell.restart",
  "whs.shell.set-volume",
];
