# @whs/game-bridge — Protocol v2

Breaking, framework-independent `postMessage` SDK for separately hosted WHG games in WHP. **Protocol v1 is not accepted.** Pin an immutable SDK commit in both hosts and games.

## Ownership and startup

WHP owns the outer chapter journey, media, iframe, persistence and optional toolbar. WHG owns menus, difficulty, Ready, gameplay, outcomes and replay. `initialized` means the game menu is available, **not** that play began. WHP never sends Start and never triggers gameplay. Start stays on a game-owned user gesture (including audio unlock/pointer lock).

```ts
import { createGameBridge } from '@whs/game-bridge';
const bridge = createGameBridge({ gameId: 'chapter-id', parentOrigin: 'https://shell.example', capabilities: ['pause','restart','checkpoint'] });
bridge.onInitialize(({ payload }) => restoreCheckpoint(payload.checkpoint));
bridge.onViewport(({ width, height, devicePixelRatio, fullscreen }) => fitGame(width, height));
bridge.onPause(() => pauseGame());
bridge.onResume(() => resumeGame());
bridge.onRestart(() => showGameMenu()); // not startGame()
void bridge.ready(); // ready → initialize → initialized; do not start a timer here
startButton.onclick = async () => {
  const started = await startGameFromGesture();
  if (started) bridge.started();
};
replayButton.onclick = async () => {
  bridge.requestRestart(); // ends old attempt BEFORE starting the next
  const started = await startGameFromGesture();
  if (started) bridge.started();
};
// On actual game outcomes only:
bridge.completed({ score: 100 }); // or bridge.failed({ reason: 'out-of-time' });
```

```ts
import { createGameHost } from '@whs/game-bridge';
const host = createGameHost({ iframe, gameId: 'chapter-id', expectedOrigin: 'https://game.example',
  checkpoint: savedCheckpoint, onStateChange: state => { if (state === 'initialized') hideLoadingOverlay(); },
  onMessage: message => { /* persist checkpoint/completed/failed; reset per-attempt UI on request-restart */ },
});
// No host.start(). Optional toolbar controls only if advertised:
if (host.capabilities.includes('pause')) host.pause();
if (host.capabilities.includes('restart')) host.restart(); // returns to game menu
host.destroy(); // when iframe is torn down or replaced
```

## Wire contract

Each envelope has `{ protocol: 'whs', version: 2, type, sessionId?, payload? }`. A game's `whs.game.ready` has `{ gameId, capabilities }` but no session ID. The host replies `whs.shell.initialize` with `{ gameId, settings: { volume, soundEnabled }, checkpoint? }` and its fresh session ID. The game responds `whs.game.initialized`. The host exposes the iframe, sends `whs.shell.viewport`, and sends later viewport changes whenever the iframe dimensions, device pixel ratio, orientation or fullscreen status change. The payload is `{ width, height, devicePixelRatio, fullscreen }` with finite positive CSS-pixel dimensions and DPR. A ResizeObserver plus coalesced animation frame and unchanged-message check prevent floods; games must not resize the host iframe in response.

On the game's own successful Start, emit `whs.game.started` **once per attempt**. `whs.game.checkpoint` (advertise `checkpoint`), `whs.game.completed`, `whs.game.failed`, `whs.game.error` and bounded `whs.game.event` retain their roles. `pause`/`resume`, `restart` and `set-volume` require advertised capabilities. Shell `restart` returns both peers to `initialized` and calls the game's reset-to-menu callback; it does not start play. Game-owned replay from `started`, `paused`, `completed` or `failed` calls `requestRestart()` before starting another attempt; the validated `whs.game.request-restart` advances both peers to `initialized` and the new successful start emits `started`. Duplicates within an attempt are ignored; terminal reports in subsequent attempts are accepted. A saved checkpoint is passed at initialization for the game to restore, while replay begins a fresh attempt (game must clear its consumed checkpoint). WHP keeps chapter-completed precedence in persistence; this protocol does not store attempt history.

## Security

Incoming messages require exact HTTP(S) parent/iframe origin, exact source window, valid protocol/version, bounded UTF-8 serialized size (≤8 KiB), validated payloads and matching session after initialization. The game ID must match during handshake. Malformed or stale messages cannot trigger actions. Only the initial ready has no session; no wildcard origin, player identity, authentication, tokens or raw postMessage bypass is allowed. Schema: `schema/v2/protocol.schema.json`.

## Verify

`npm ci && npm run typecheck && npm test && npm run build && npm run test:browser`. The mock game fixture under `examples/mock-game` exercises the iframe handshake without shell-owned Start.
