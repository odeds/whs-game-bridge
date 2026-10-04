import { PROTOCOL, PROTOCOL_VERSION, type EventProperties, type GameMessage, type ShellMessage } from "./protocol.js";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T>(error: string): ValidationResult<T> => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const session = (v: unknown): v is string => string(v, 128) && /^[A-Za-z0-9._:-]+$/.test(v);
const volume = (v: unknown) => finite(v) && v >= 0 && v <= 1;
const payloadRecord = (v: unknown): v is Record<string, unknown> => isRecord(v);
const noPayload = (v: unknown) => v === undefined;
const capabilities = new Set(["pause", "restart", "checkpoint", "volume"]);

function base(data: unknown): ValidationResult<Record<string, unknown>> {
  if (!isRecord(data)) return fail("message must be an object");
  if (data.protocol !== PROTOCOL) return fail("invalid protocol");
  if (data.version !== PROTOCOL_VERSION) return fail("unsupported protocol version");
  if (typeof data.type !== "string") return fail("missing message type");
  if (data.sessionId !== undefined && !session(data.sessionId)) return fail("invalid sessionId");
  try { if (JSON.stringify(data).length > 8192) return fail("message too large"); } catch { return fail("unserializable message"); }
  return { ok: true, value: data };
}
function properties(value: unknown): value is EventProperties {
  if (!isRecord(value) || Object.keys(value).length > 20) return false;
  return Object.values(value).every((v) => typeof v === "string" || typeof v === "boolean" || finite(v));
}

export function parseGameMessage(data: unknown): ValidationResult<GameMessage> {
  const b = base(data); if (!b.ok) return b; const m = b.value; const p = m.payload;
  switch (m.type) {
    case "whs.game.ready":
      if (!payloadRecord(p) || !string(p.gameId, 128) || !Array.isArray(p.capabilities) || p.capabilities.some((x) => typeof x !== "string" || !capabilities.has(x))) return fail("invalid ready payload"); break;
    case "whs.game.initialized": case "whs.game.started":
      if (!noPayload(p) || !session(m.sessionId)) return fail("invalid lifecycle message"); break;
    case "whs.game.checkpoint": if (!payloadRecord(p) || !string(p.checkpoint, 256) || !session(m.sessionId)) return fail("invalid checkpoint payload"); break;
    case "whs.game.completed": if (!payloadRecord(p) || (p.score !== undefined && !finite(p.score)) || !session(m.sessionId)) return fail("invalid completed payload"); break;
    case "whs.game.failed": if (!payloadRecord(p) || !string(p.reason, 256) || !session(m.sessionId)) return fail("invalid failed payload"); break;
    case "whs.game.error": if (!payloadRecord(p) || !string(p.message, 512) || (p.code !== undefined && !string(p.code, 128)) || !session(m.sessionId)) return fail("invalid error payload"); break;
    case "whs.game.event": if (!payloadRecord(p) || !string(p.name, 64) || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(p.name) || (p.properties !== undefined && !properties(p.properties)) || !session(m.sessionId)) return fail("invalid event payload"); break;
    default: return fail("unknown game message type");
  }
  return { ok: true, value: m as unknown as GameMessage };
}

export function parseShellMessage(data: unknown): ValidationResult<ShellMessage> {
  const b = base(data); if (!b.ok) return b; const m = b.value; const p = m.payload;
  if (!session(m.sessionId)) return fail("missing sessionId");
  switch (m.type) {
    case "whs.shell.initialize":
      if (!payloadRecord(p) || !string(p.gameId, 128) || !payloadRecord(p.settings) || !volume(p.settings.volume) || typeof p.settings.soundEnabled !== "boolean") return fail("invalid initialize payload"); break;
    case "whs.shell.start": case "whs.shell.pause": case "whs.shell.resume": case "whs.shell.restart": if (!noPayload(p)) return fail("unexpected payload"); break;
    case "whs.shell.set-volume": if (!payloadRecord(p) || !volume(p.volume)) return fail("invalid volume payload"); break;
    default: return fail("unknown shell message type");
  }
  return { ok: true, value: m as unknown as ShellMessage };
}
