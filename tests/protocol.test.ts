import { describe, expect, it } from 'vitest';
import { parseGameMessage, parseShellMessage } from '../src/validation.js';
import { PROTOCOL_VERSION } from '../src/protocol.js';
const message = (type: string, payload?: unknown, sessionId: string | null = 'session') => ({
  protocol: 'whs', version: PROTOCOL_VERSION, type,
  ...(sessionId === null ? {} : { sessionId }), ...(payload === undefined ? {} : { payload }),
});
const viewport = { width: 640, height: 480, devicePixelRatio: 2, fullscreen: false };
describe('breaking Protocol v2 validation', () => {
  it.each([
    message('whs.game.ready', { gameId: 'game', capabilities: ['pause'] }, null),
    message('whs.game.initialized'), message('whs.game.started'), message('whs.game.request-restart'),
    message('whs.game.checkpoint', { checkpoint: 'boss' }), message('whs.game.completed', { score: 42 }),
    message('whs.game.failed', { reason: 'missed' }), message('whs.game.error', { message: 'bad' }),
    message('whs.game.event', { name: 'hit', properties: { count: 1 } }),
  ])('accepts a valid game message', m => expect(parseGameMessage(m).ok).toBe(true));
  it.each([
    message('whs.shell.initialize', { gameId: 'game', settings: { volume: 1, soundEnabled: true }, checkpoint: 'boss' }),
    message('whs.shell.viewport', viewport), message('whs.shell.pause'), message('whs.shell.resume'),
    message('whs.shell.restart'), message('whs.shell.set-volume', { volume: .5 }),
  ])('accepts a valid shell message', m => expect(parseShellMessage(m).ok).toBe(true));
  it.each([
    message('whs.shell.viewport', { ...viewport, width: 0 }),
    message('whs.shell.viewport', { ...viewport, height: Infinity }),
    message('whs.shell.viewport', { ...viewport, devicePixelRatio: -1 }),
    message('whs.shell.viewport', { ...viewport, fullscreen: 1 }),
    message('whs.shell.viewport', { ...viewport, extra: true }),
    message('whs.shell.viewport', viewport, null),
    message('whs.shell.initialize', { gameId: 'game', settings: { volume: 1, soundEnabled: true }, checkpoint: '' }),
    message('whs.shell.start'),
  ])('rejects invalid shell payloads and removed start', m => expect(parseShellMessage(m).ok).toBe(false));
  it.each([
    message('whs.game.started', {}), message('whs.game.request-restart', {}),
    message('whs.game.failed', {}), message('whs.game.completed', { score: NaN }),
    message('whs.game.event', { name: 'bad name' }),
    { ...message('whs.game.started'), version: 1 },
    { ...message('whs.game.started'), protocol: 'other' },
  ])('rejects malformed and old game messages', m => expect(parseGameMessage(m).ok).toBe(false));
});
