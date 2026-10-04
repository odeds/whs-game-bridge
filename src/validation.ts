import {
  PROTOCOL,
  PROTOCOL_VERSION,
  type EventProperties,
  type GameMessage,
  type ShellMessage,
} from "./protocol.js";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const MAX_MESSAGE_BYTES = 8192;
const capabilities = new Set(["pause", "restart", "checkpoint", "volume"]);
const fail = <T>(error: string): ValidationResult<T> => ({ ok: false, error });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = 256): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isSessionId = (value: unknown): value is string =>
  isString(value, 128) && /^[A-Za-z0-9._:-]+$/.test(value);
const isVolume = (value: unknown) =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

function parseEnvelope(data: unknown): ValidationResult<Record<string, unknown>> {
  if (!isRecord(data)) return fail("message must be an object");
  if (data.protocol !== PROTOCOL) return fail("invalid protocol");
  if (data.version !== PROTOCOL_VERSION) return fail("unsupported protocol version");
  if (typeof data.type !== "string") return fail("missing message type");
  if (data.sessionId !== undefined && !isSessionId(data.sessionId)) {
    return fail("invalid sessionId");
  }

  try {
    const serialized = JSON.stringify(data);
    if (serialized === undefined) return fail("unserializable message");
    if (new TextEncoder().encode(serialized).byteLength > MAX_MESSAGE_BYTES) {
      return fail("message too large");
    }
  } catch {
    return fail("unserializable message");
  }

  return { ok: true, value: data };
}

function isEventProperties(value: unknown): value is EventProperties {
  if (!isRecord(value) || Object.keys(value).length > 20) return false;
  return Object.values(value).every(
    (item) => typeof item === "string" || typeof item === "boolean" || isFiniteNumber(item),
  );
}

export function parseGameMessage(data: unknown): ValidationResult<GameMessage> {
  const envelope = parseEnvelope(data);
  if (!envelope.ok) return envelope;

  const message = envelope.value;
  const payload = message.payload;
  switch (message.type) {
    case "whs.game.ready":
      if (
        !isRecord(payload) ||
        !isString(payload.gameId, 128) ||
        !Array.isArray(payload.capabilities) ||
        message.sessionId !== undefined ||
        payload.capabilities.some(
          (capability) => typeof capability !== "string" || !capabilities.has(capability),
        )
      ) return fail("invalid ready payload");
      break;
    case "whs.game.initialized":
    case "whs.game.started":
      if (payload !== undefined || !isSessionId(message.sessionId)) {
        return fail("invalid lifecycle message");
      }
      break;
    case "whs.game.checkpoint":
      if (!isRecord(payload) || !isString(payload.checkpoint, 256) || !isSessionId(message.sessionId)) {
        return fail("invalid checkpoint payload");
      }
      break;
    case "whs.game.completed":
      if (
        (payload !== undefined && (!isRecord(payload) || (payload.score !== undefined && !isFiniteNumber(payload.score)))) ||
        !isSessionId(message.sessionId)
      ) return fail("invalid completed payload");
      break;
    case "whs.game.failed":
      if (!isRecord(payload) || !isString(payload.reason, 256) || !isSessionId(message.sessionId)) {
        return fail("invalid failed payload");
      }
      break;
    case "whs.game.error":
      if (
        !isRecord(payload) ||
        !isString(payload.message, 512) ||
        (payload.code !== undefined && !isString(payload.code, 128)) ||
        !isSessionId(message.sessionId)
      ) return fail("invalid error payload");
      break;
    case "whs.game.event":
      if (
        !isRecord(payload) ||
        !isString(payload.name, 64) ||
        !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(payload.name) ||
        (payload.properties !== undefined && !isEventProperties(payload.properties)) ||
        !isSessionId(message.sessionId)
      ) return fail("invalid event payload");
      break;
    default:
      return fail("unknown game message type");
  }

  return { ok: true, value: message as unknown as GameMessage };
}

export function parseShellMessage(data: unknown): ValidationResult<ShellMessage> {
  const envelope = parseEnvelope(data);
  if (!envelope.ok) return envelope;

  const message = envelope.value;
  const payload = message.payload;
  if (!isSessionId(message.sessionId)) return fail("missing sessionId");

  switch (message.type) {
    case "whs.shell.initialize":
      if (
        !isRecord(payload) ||
        !isString(payload.gameId, 128) ||
        !isRecord(payload.settings) ||
        !isVolume(payload.settings.volume) ||
        typeof payload.settings.soundEnabled !== "boolean"
      ) return fail("invalid initialize payload");
      break;
    case "whs.shell.start":
    case "whs.shell.pause":
    case "whs.shell.resume":
    case "whs.shell.restart":
      if (payload !== undefined) return fail("unexpected payload");
      break;
    case "whs.shell.set-volume":
      if (!isRecord(payload) || !isVolume(payload.volume)) {
        return fail("invalid volume payload");
      }
      break;
    default:
      return fail("unknown shell message type");
  }

  return { ok: true, value: message as unknown as ShellMessage };
}
