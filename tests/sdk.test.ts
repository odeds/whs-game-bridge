import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameBridge } from '../src/game.js';
import { createGameHost } from '../src/host.js';
import { PROTOCOL_VERSION } from '../src/protocol.js';

class FakeWindow {
  listeners = new Set<(event: MessageEvent) => void>();
  posts: Array<{ data: any; origin: string }> = [];
  parent: FakeWindow = this;
  devicePixelRatio = 2;
  frame = 0;
  addEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.add(listener); }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) { this.listeners.delete(listener); }
  postMessage(data: unknown, origin: string) { this.posts.push({ data, origin }); }
  dispatch(data: unknown, origin: string, source: unknown) {
    this.listeners.forEach(listener => listener({ data, origin, source } as MessageEvent));
  }
  requestAnimationFrame(callback: FrameRequestCallback) { callback(0); return ++this.frame; }
  cancelAnimationFrame() { /* no-op */ }
}
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalObserver = globalThis.ResizeObserver;
const doc = { fullscreenElement: null, addEventListener() {}, removeEventListener() {} } as unknown as Document;
const msg = (type: string, sessionId?: string, payload?: unknown) => ({
  protocol: 'whs', version: PROTOCOL_VERSION, type,
  ...(sessionId === undefined ? {} : { sessionId }), ...(payload === undefined ? {} : { payload }),
});
const iframe = (game: FakeWindow) => ({ contentWindow: game,
  getBoundingClientRect: () => ({ width: 800, height: 450 }),
}) as unknown as HTMLIFrameElement;
const ready = msg('whs.game.ready', undefined, { gameId: 'game', capabilities: ['pause', 'restart', 'checkpoint', 'volume'] });
const initialize = (session: string) => msg('whs.shell.initialize', session, { gameId: 'game', settings: { volume: 1, soundEnabled: true }, checkpoint: 'saved' });
function environment(fake: FakeWindow) {
  (globalThis as { window: unknown }).window = fake;
  (globalThis as { document: unknown }).document = doc;
}
afterEach(() => {
  (globalThis as { window: unknown }).window = originalWindow;
  (globalThis as { document: unknown }).document = originalDocument;
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = originalObserver;
  vi.useRealTimers();
});

describe('host v2', () => {
  function connect(shell: FakeWindow, game: FakeWindow, onMessage?: (type: string) => void) {
    environment(shell);
    const host = createGameHost({ iframe: iframe(game), gameId: 'game', expectedOrigin: 'https://game.test', checkpoint: 'saved',
      onMessage: m => onMessage?.(m.type) });
    shell.dispatch(ready, 'https://game.test', game);
    shell.dispatch(msg('whs.game.initialized', host.sessionId), 'https://game.test', game);
    return host;
  }
  it('passes an optional saved checkpoint at initialization and rejects malformed checkpoints', () => {
    const shell = new FakeWindow(), game = new FakeWindow(); environment(shell);
    const options = { iframe: iframe(game), gameId: 'game', expectedOrigin: 'https://game.test' };
    expect(() => createGameHost({ ...options, checkpoint: 'x'.repeat(257) })).toThrow();
    expect(() => createGameHost({ ...options, checkpoint: '' })).toThrow();
    const host = createGameHost({ ...options, checkpoint: 'hanoi-rat-king:v1:250:180' });
    shell.dispatch(ready, 'https://game.test', game);
    expect(game.posts[0]?.data).toMatchObject({ type: 'whs.shell.initialize', payload: { checkpoint: 'hanoi-rat-king:v1:250:180' } });
    host.destroy();
    game.posts = [];
    const withoutCheckpoint = createGameHost(options);
    shell.dispatch(ready, 'https://game.test', game);
    expect(game.posts[0]?.data).toMatchObject({ payload: { gameId: 'game' } });
    expect(game.posts[0]?.data.payload.checkpoint).toBeUndefined();
    withoutCheckpoint.destroy();
  });
  it('rejects untrusted and v1 messages, waits for initialization, then sends a viewport; never starts play', () => {
    const shell = new FakeWindow(), game = new FakeWindow(); environment(shell);
    const errors: string[] = [];
    const host = createGameHost({ iframe: iframe(game), gameId: 'game', expectedOrigin: 'https://game.test',
      onProtocolError: e => errors.push(e) });
    shell.dispatch(ready, 'https://evil.test', game);
    shell.dispatch(ready, 'https://game.test', new FakeWindow());
    shell.dispatch({ ...ready, version: 1 }, 'https://game.test', game);
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    expect(host.state).toBe('waiting');
    expect(errors).toEqual(['unsupported protocol version']);
    shell.dispatch(ready, 'https://game.test', game);
    expect(game.posts.map(p => p.data.type)).toEqual(['whs.shell.initialize']);
    shell.dispatch(msg('whs.game.initialized', 'stale'), 'https://game.test', game);
    expect(host.state).toBe('initializing');
    shell.dispatch(msg('whs.game.initialized', host.sessionId), 'https://game.test', game);
    expect(host.state).toBe('initialized');
    expect(game.posts.at(-1)?.data).toMatchObject({ type: 'whs.shell.viewport', payload: { width: 800, height: 450, devicePixelRatio: 2, fullscreen: false } });
    expect('start' in host).toBe(false);
    host.destroy();
  });
  it('tracks attempts and suppresses premature, duplicate and stale terminal reports', () => {
    const shell = new FakeWindow(), game = new FakeWindow(), events: string[] = [];
    const host = connect(shell, game, type => events.push(type));
    shell.dispatch(msg('whs.game.completed', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.started', 'stale'), 'https://game.test', game);
    expect(host.state).toBe('initialized');
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.failed', host.sessionId, { reason: 'lost' }), 'https://game.test', game);
    shell.dispatch(msg('whs.game.completed', host.sessionId), 'https://game.test', game);
    expect(host.state).toBe('failed');
    shell.dispatch(msg('whs.game.request-restart', 'stale'), 'https://game.test', game);
    expect(host.state).toBe('failed');
    shell.dispatch(msg('whs.game.request-restart', host.sessionId), 'https://game.test', game);
    expect(host.state).toBe('initialized');
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.completed', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.request-restart', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    shell.dispatch(msg('whs.game.completed', host.sessionId), 'https://game.test', game);
    expect(events.filter(e => e === 'whs.game.completed')).toHaveLength(2);
    expect(events.filter(e => e === 'whs.game.started')).toHaveLength(3);
    host.destroy();
  });
  it('supports pause, resume, restart and checkpoint capabilities', () => {
    const shell = new FakeWindow(), game = new FakeWindow(), events: string[] = [];
    const host = connect(shell, game, type => events.push(type));
    expect(game.posts[0]?.data.payload.checkpoint).toBe('saved');
    shell.dispatch(msg('whs.game.started', host.sessionId), 'https://game.test', game);
    expect(host.pause()).toBe(true); expect(host.resume()).toBe(true);
    shell.dispatch(msg('whs.game.checkpoint', host.sessionId, { checkpoint: 'boss' }), 'https://game.test', game);
    expect(events).toContain('whs.game.checkpoint');
    expect(host.setVolume(.4)).toBe(true);
    expect(host.restart()).toBe(true);
    expect(host.state).toBe('initialized');
    host.destroy();
  });
  it('coalesces viewport observations, ignores duplicates and cleans up on destroy', () => {
    const shell = new FakeWindow(), game = new FakeWindow(); environment(shell);
    let callback: (() => void) | undefined;
    const disconnect = vi.fn();
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(fn: () => void) { callback = fn; }
      observe() {} disconnect() { disconnect(); }
    };
    const host = connect(shell, game);
    const initial = game.posts.length;
    callback?.(); callback?.();
    expect(game.posts).toHaveLength(initial);
    host.destroy(); callback?.();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(game.posts).toHaveLength(initial);
  });
  it('coalesces changing iframe content size, DPR, orientation and fullscreen updates', () => {
    const shell = new FakeWindow(), game = new FakeWindow(); environment(shell);
    const callbacks = new Map<string, () => void>();
    const documentStub = {
      fullscreenElement: null as Element | null,
      addEventListener: (type: string, callback: () => void) => callbacks.set(type, callback),
      removeEventListener: (type: string) => callbacks.delete(type),
    };
    (globalThis as { document: unknown }).document = documentStub;
    let pending: FrameRequestCallback | undefined;
    shell.requestAnimationFrame = (fn) => { pending = fn; return 1; };
    const flush = () => { const fn = pending; pending = undefined; fn?.(0); };
    let width = 800, height = 450;
    const element = {
      contentWindow: game,
      get clientWidth() { return width; },
      get clientHeight() { return height; },
      getBoundingClientRect: () => ({ width: width + 4, height: height + 4 }),
    } as unknown as HTMLIFrameElement;
    const host = createGameHost({ iframe: element, gameId: 'game', expectedOrigin: 'https://game.test' });
    shell.dispatch(ready, 'https://game.test', game);
    shell.dispatch(msg('whs.game.initialized', host.sessionId), 'https://game.test', game);
    flush();
    expect(game.posts.at(-1)?.data.payload).toEqual({ width: 800, height: 450, devicePixelRatio: 2, fullscreen: false });
    const count = game.posts.length;
    shell.dispatch(null, 'https://irrelevant.test', null); // no incoming resize messages
    shell.listeners.forEach(listener => listener({ type: 'resize' } as MessageEvent));
    flush(); expect(game.posts).toHaveLength(count);
    width = 640; height = 360; shell.devicePixelRatio = 3;
    shell.listeners.forEach(listener => listener({ type: 'orientationchange' } as MessageEvent));
    flush();
    expect(game.posts.at(-1)?.data.payload).toMatchObject({ width: 640, height: 360, devicePixelRatio: 3 });
    documentStub.fullscreenElement = { contains: (target: unknown) => target === element } as Element;
    callbacks.get('fullscreenchange')?.(); flush();
    expect(game.posts.at(-1)?.data.payload.fullscreen).toBe(true);
    host.destroy();
    expect(callbacks.has('fullscreenchange')).toBe(false);
  });
  it('times out without initializing', () => {
    vi.useFakeTimers(); const shell = new FakeWindow(), game = new FakeWindow(); environment(shell);
    const host = createGameHost({ iframe: iframe(game), gameId: 'game', expectedOrigin: 'https://game.test', handshakeTimeoutMs: 5 });
    vi.advanceTimersByTime(5); expect(host.state).toBe('timed-out'); host.destroy();
  });
});

describe('game SDK v2', () => {
  it('only starts after initialization, validates viewport origin/session and replays after failure and completion', async () => {
    const game = new FakeWindow(), parent = new FakeWindow(); game.parent = parent; environment(game);
    const bridge = createGameBridge({ gameId: 'game', parentOrigin: 'https://shell.test', capabilities: ['pause','restart','checkpoint'] });
    const widths: number[] = [];
    bridge.onViewport(v => widths.push(v.width));
    bridge.started(); expect(parent.posts).toHaveLength(0);
    const promise = bridge.ready();
    game.dispatch(initialize('session'), 'https://evil.test', parent);
    game.dispatch(initialize('session'), 'https://shell.test', new FakeWindow());
    expect(bridge.state).toBe('ready');
    game.dispatch(initialize('session'), 'https://shell.test', parent); await promise;
    game.dispatch(msg('whs.shell.viewport', 'stale', { width: 400, height: 300, devicePixelRatio: 1, fullscreen: false }), 'https://shell.test', parent);
    game.dispatch(msg('whs.shell.viewport', 'session', { width: -1, height: 300, devicePixelRatio: 1, fullscreen: false }), 'https://shell.test', parent);
    expect(widths).toEqual([]);
    game.dispatch(msg('whs.shell.viewport', 'session', { width: 400, height: 300, devicePixelRatio: 1, fullscreen: false }), 'https://shell.test', parent);
    expect(widths).toEqual([400]);
    bridge.started(); bridge.started(); bridge.failed({ reason: 'lost' }); bridge.failed({ reason: 'duplicate' });
    expect(bridge.requestRestart()).toBe(true);
    bridge.started(); bridge.completed({ score: 1 }); bridge.completed({ score: 2 });
    expect(bridge.requestRestart()).toBe(true);
    bridge.started(); bridge.completed({ score: 3 });
    const types = parent.posts.map(p => p.data.type);
    expect(types.filter(t => t === 'whs.game.started')).toHaveLength(3);
    expect(types.filter(t => t === 'whs.game.completed')).toHaveLength(2);
    expect(types.filter(t => t === 'whs.game.request-restart')).toHaveLength(2);
    bridge.destroy();
    game.dispatch(msg('whs.shell.viewport', 'session', { width: 500, height: 300, devicePixelRatio: 1, fullscreen: false }), 'https://shell.test', parent);
    expect(widths).toEqual([400]);
  });
});
