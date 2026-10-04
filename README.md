# @whs/game-bridge

A small, framework-independent browser `postMessage` boundary between a WHS shell and separately hosted games. It implements **WHS Protocol v1**; package and protocol versions are intentionally separate.

## Install

```sh
npm install @whs/game-bridge
```

## Minimal game integration

The game must be embedded in an iframe and must be configured with the shell's exact origin (never `*`). It announces readiness, waits for initialization, then reports game lifecycle events.

```ts
import { createGameBridge } from "@whs/game-bridge";

const whs = createGameBridge({
  gameId: "emu-war",
  parentOrigin: "https://whs.example",
  capabilities: ["pause", "restart", "checkpoint", "volume"],
});
whs.onStart(() => {
  startGame();
  whs.started(); // acknowledge that the game started
});
whs.onPause(() => pauseGame());
whs.onResume(() => resumeGame());
whs.onRestart(() => resetGame());

await whs.ready(); // sends ready; resolves after shell initialize
whs.checkpoint({ checkpoint: "wave-2" });
whs.completed({ score: 1250 });
```

## Minimal host integration

`expectedOrigin` must come from WHS's trusted game catalog, not a game message. The SDK validates both that origin and the exact iframe `contentWindow`, generates a fresh session ID, and ignores stale-session messages.

```ts
import { createGameHost } from "@whs/game-bridge";

const playButton = document.querySelector<HTMLButtonElement>("#play")!;
const game = createGameHost({
  iframe: document.querySelector("#game")!,
  gameId: "emu-war",
  expectedOrigin: "https://games.example",
  settings: { volume: 0.8, soundEnabled: true },
  onMessage: (message) => console.log(message.type),
  onStateChange: (state) => {
    if (state === "initialized") {
      // Enable the shell's Play button; call game.start() from its handler.
    }
  },
});

// The host automatically sends initialize after a valid game ready + origin/source check.
playButton.addEventListener("click", () => {
  if (game.state === "initialized") game.start();
});

// During play, only call optional controls the game advertised:
if (game.capabilities.includes("pause")) game.pause();
if (game.capabilities.includes("restart")) game.restart();
if (game.capabilities.includes("volume")) game.setVolume(0.5);
```

## Public API

Import the SDK and protocol types from the package root; deep imports are not supported:

```ts
import {
  createGameBridge, createGameHost,
  PROTOCOL, PROTOCOL_VERSION,
  gameCapabilities, hasGameCapability,
  type GameBridge, type GameBridgeOptions, type GameState,
  type GameHost, type GameHostOptions, type HostState,
  type GameCapability, type GameCapabilities,
  type GameMessage, type ShellMessage,
  type ReadyPayload, type InitializePayload, type CheckpointPayload,
  type CompletedPayload, type FailedPayload, type ErrorPayload,
  type EventPayload, type EventProperties, type VolumePayload,
} from "@whs/game-bridge";
```

## Lifecycle and capabilities

`ready`, shell `initialize`, shell `start`, game `initialized`, and game `started` are mandatory lifecycle behavior. A game must always accept a valid `start` after initialization and acknowledge it with `started()` when it has started.

The `capabilities` in `whs.game.ready` are authoritative declarations of optional behavior:

- `pause` permits both shell `pause` and `resume`; without it, the host returns `false` and sends neither command, and the game ignores either command if received.
- `restart` permits shell `restart`; without it, the host does not send it and the game ignores it.
- `volume` permits shell `setVolume`; without it, the host does not send it and the game ignores it.
- `checkpoint` permits the game to emit `whs.game.checkpoint`; without it, `bridge.checkpoint()` emits nothing and the host ignores checkpoint messages.

`GameHost.capabilities` is the de-duplicated capability set from the accepted ready handshake. Use `hasGameCapability(game.capabilities, "pause")` when a typed check is preferable to `includes`.

## Protocol safety

All received messages are runtime-validated. Protocol v1 accepts only its documented message types, version `1`, bounded payloads (whole UTF-8 serialized message ≤8 KiB), and session IDs after initialization. `whs.game.event` is deliberately bounded: its name is 64 characters max and its optional properties contain at most 20 primitive values. Unknown additive fields are ignored for v1 compatibility.

No player identity, authentication, tokens, persistence, analytics, or WHS API access belongs in this protocol.

## Development

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
```

The deterministic iframe fixture is in `examples/mock-game`. It displays bridge state, session ID, and the last sent/received messages, and provides lifecycle controls.
