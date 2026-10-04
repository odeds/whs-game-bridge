import {
  PROTOCOL,
  PROTOCOL_VERSION,
  createGameBridge,
  createGameHost,
  gameCapabilities,
  hasGameCapability,
  type CheckpointPayload,
  type CompletedPayload,
  type Envelope,
  type ErrorPayload,
  type EventPayload,
  type EventProperties,
  type FailedPayload,
  type GameBridge,
  type GameBridgeOptions,
  type GameCapability,
  type GameCapabilities,
  type GameHost,
  type GameHostOptions,
  type GameMessage,
  type GameMessageType,
  type GameState,
  type HostState,
  type InitializePayload,
  type MessageType,
  type ReadyPayload,
  type ShellMessage,
  type ShellMessageType,
  type VolumePayload,
} from "@whs/game-bridge";

const bridgeOptions: GameBridgeOptions = { gameId: "game", parentOrigin: "https://shell.test" };
const hostOptions = null as unknown as GameHostOptions;
const bridge = null as unknown as GameBridge;
const host = null as unknown as GameHost;
const capability: GameCapability = "checkpoint";
const gameState = null as unknown as GameState;
const hostState = null as unknown as HostState;
const ready: ReadyPayload = { gameId: "game", capabilities: [capability] };
const initialize: InitializePayload = { gameId: "game", settings: { volume: 1, soundEnabled: true } };
const checkpoint: CheckpointPayload = { checkpoint: "wave-2" };
const completed: CompletedPayload = { score: 1 };
const failed: FailedPayload = { reason: "failed" };
const error: ErrorPayload = { message: "error" };
const eventProperties: EventProperties = { level: 1 };
const event: EventPayload = { name: "game_started", properties: eventProperties };
const volume: VolumePayload = { volume: 0.5 };
const capabilities: GameCapabilities = [capability];
const envelope = null as unknown as Envelope;
const gameMessageType = null as unknown as GameMessageType;
const messageType = null as unknown as MessageType;
const shellMessageType = null as unknown as ShellMessageType;
const gameMessage = null as unknown as GameMessage;
const shellMessage = null as unknown as ShellMessage;

void [
  PROTOCOL, PROTOCOL_VERSION, createGameBridge, createGameHost, gameCapabilities,
  hasGameCapability(capabilities, capability), bridgeOptions, hostOptions, bridge, host,
  gameState, hostState, initialize, checkpoint, completed, failed, error, event, volume, envelope,
  gameMessage, gameMessageType, messageType, shellMessage, shellMessageType,
];
