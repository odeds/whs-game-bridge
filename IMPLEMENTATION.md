# WHS Game Bridge

## Purpose

`whs-game-bridge` defines the communication boundary between Weird History Shell (WHS) and independently deployed browser games.

Games are intentionally isolated static applications hosted on separate origins and loaded by the WHS shell inside iframes.

A game must never directly access:

- the WHS database
- WHS authentication
- WHS HTTP APIs
- PostHog or other platform analytics
- bookmarks
- player identity
- sponsorship/payment state
- WHS persistence

All communication between a game and WHS must go through this bridge using `window.postMessage`.

The bridge must remain small, framework-independent and game-engine-independent.

It must work equally well with:

- vanilla TypeScript
- Three.js
- PixiJS
- Phaser
- React
- Vue
- Godot web exports
- any future static browser game

## Model

Recommended implementation model:

**GPT-6 Sol with High reasoning**

This repository is small, but its protocol is a long-lived platform boundary. Prefer careful protocol design, tests and backwards compatibility over rapid implementation.

---

# Core principles

1. The wire protocol is the source of truth.
2. The npm SDK is a convenience layer around the protocol.
3. SDK version and protocol version are separate concepts.
4. Games never call WHS APIs directly.
5. Games never know the WHS user identity.
6. Games never send arbitrary analytics directly to PostHog.
7. All incoming messages must be validated.
8. Production messages must never rely on `targetOrigin = "*"`.
9. The shell must validate the iframe origin independently of values supplied by the game.
10. Protocol changes must be backwards compatible within a protocol major version.

---

# Repository structure

Target structure:

```text
whs-game-bridge/
├── src/
│   ├── game.ts
│   ├── host.ts
│   ├── protocol.ts
│   ├── messages.ts
│   ├── validation.ts
│   └── index.ts
│
├── schema/
│   └── v1/
│       └── protocol.schema.json
│
├── examples/
│   └── mock-game/
│
├── tests/
│
├── package.json
├── tsconfig.json
├── README.md
└── IMPLEMENTATION.md
```

Do not introduce React, Vue, Alpine, Zustand or another UI/state framework.

The package should have minimal runtime dependencies.

---

# Protocol envelope

All messages must use a common envelope.

Conceptually:

```ts
interface WHSMessage<T = unknown> {
  protocol: "whs";
  version: 1;
  type: string;
  sessionId?: string;
  payload?: T;
}
```

Do not put player IDs, email addresses, auth tokens or database IDs into the game protocol.

---

# Protocol v1 lifecycle

The initial protocol should support this lifecycle:

```text
iframe loaded
    ↓
game → ready
    ↓
shell validates game/origin/version
    ↓
shell → initialize
    ↓
game → initialized
    ↓
shell → start
    ↓
game → started
    ↓
gameplay
    ↓
game → checkpoint(s)
    ↓
game → completed | failed
```

The shell may additionally send:

```text
pause
resume
restart
set-volume
```

Do not add messages until there is a concrete WHS use case for them.

---

# Game → Shell messages

Protocol v1 should initially support:

```text
whs.game.ready
whs.game.initialized
whs.game.started
whs.game.checkpoint
whs.game.completed
whs.game.failed
whs.game.error
whs.game.event
```

## ready

Used by the game to announce that its code and required initial assets are ready to communicate.

Example payload:

```ts
{
  gameId: "emu-war",
  capabilities: [
    "pause",
    "restart",
    "checkpoint"
  ]
}
```

Capabilities must come from a fixed typed set rather than arbitrary strings where practical.

## checkpoint

Example:

```ts
{
  checkpoint: "wave-2"
}
```

The checkpoint value is game-defined.

The shell decides whether and how it becomes persistent player progress.

## completed

Example:

```ts
{
  score: 1250
}
```

Score is optional.

The protocol must allow completion without requiring every game to implement scoring.

## failed

Example:

```ts
{
  reason: "player-defeated"
}
```

The shell must not depend on specific game-defined failure reasons.

## event

Used only for bounded game-specific telemetry that the shell may decide to forward to analytics.

Example:

```ts
{
  name: "obstacle_hit",
  properties: {
    obstacle: "market_cart"
  }
}
```

This must not become an unrestricted analytics transport.

Document size and property constraints.

---

# Shell → Game messages

Protocol v1 should initially support:

```text
whs.shell.initialize
whs.shell.start
whs.shell.pause
whs.shell.resume
whs.shell.restart
whs.shell.set-volume
```

## initialize

Example:

```ts
{
  gameId: "emu-war",
  settings: {
    volume: 0.8,
    soundEnabled: true
  }
}
```

Do not include WHS user information.

The shell session identifier belongs in the protocol envelope and exists only to reject stale or unrelated messages.

---

# Game SDK

Games should not normally use `window.postMessage` directly.

Expose a small game-facing API.

Target ergonomics:

```ts
import { createGameBridge } from "@whs/game-bridge";

const whs = createGameBridge({
  gameId: "emu-war",
});

await whs.ready();

whs.started();

whs.checkpoint({
  checkpoint: "wave-2",
});

whs.completed({
  score: 1250,
});
```

And:

```ts
whs.onPause(() => {
  pauseGame();
});

whs.onResume(() => {
  resumeGame();
});

whs.onRestart(() => {
  restartGame();
});
```

Do not expose low-level message construction when a typed high-level API is sufficient.

---

# Host SDK

The repository may also expose a small framework-independent browser-side host API for the WHS shell.

Example:

```ts
const game = createGameHost({
  iframe,
  gameId,
  expectedOrigin,
});
```

The host SDK may handle:

- handshake
- protocol parsing
- session ID
- origin validation
- lifecycle state
- timeouts
- typed callbacks

It must not contain:

- WHS database access
- HTTP persistence logic
- PostHog
- authentication
- bookmark logic
- shell UI state

Those responsibilities belong to the WHS application.

---

# Security requirements

## Origin validation

The shell must receive the expected game origin from its own trusted catalog/configuration.

Never trust an origin claimed inside a game message.

Incoming shell-side events must satisfy:

```text
event.source === expected iframe window
AND
event.origin === expected game origin
```

Game-side events must validate the WHS parent origin.

Production sending must use an explicit target origin.

Do not use:

```ts
postMessage(message, "*")
```

except where technically required during an explicitly documented bootstrap mechanism, and eliminate it from the normal established session.

## Session validation

Each iframe play session should receive a random session identifier.

After initialization, messages from a stale or different session must be ignored.

## Runtime validation

Do not rely only on TypeScript types.

Messages cross an untrusted browser boundary and must receive runtime validation.

Malformed messages should be ignored or surfaced through controlled protocol errors rather than crash either application.

---

# Versioning

Separate:

```text
npm package version
```

from:

```text
WHS wire protocol version
```

Example:

```text
@whs/game-bridge 1.8.3
```

may still implement:

```text
WHS Protocol v1
```

Do not create Protocol v2 for SDK implementation changes.

Protocol major versions should change only for wire-level breaking changes.

---

# Compatibility

The WHS shell will eventually run games built months or years apart.

Therefore:

- protocol v1 must remain stable after release
- additive optional fields are preferred
- receivers must safely ignore unknown optional fields
- removing or changing existing fields requires a new protocol major version
- the shell may support multiple protocol major versions during migrations

---

# Mock game

Create a deterministic mock game under:

```text
examples/mock-game
```

The mock game is not decorative.

It is an integration-test fixture for WHS.

It should display:

```text
current protocol state
session ID
last received message
last sent message
```

Provide controls for:

```text
READY
STARTED
CHECKPOINT
COMPLETE
FAIL
ERROR
```

It should visibly react to:

```text
INITIALIZE
START
PAUSE
RESUME
RESTART
SET VOLUME
```

Do not add a game engine.

Use minimal HTML/CSS/TypeScript.

---

# Testing

Unit tests must cover at least:

- valid message parsing
- malformed messages
- unsupported protocol versions
- wrong message types
- missing required fields
- unknown optional fields
- incorrect origin
- incorrect iframe source
- incorrect session ID
- duplicate ready
- duplicate completion
- messages after completion
- pause/resume
- restart
- handshake timeout

Browser tests must cover the mock game embedded in a host page.

Verify the entire lifecycle:

```text
load
→ ready
→ initialize
→ initialized
→ start
→ started
→ checkpoint
→ complete
```

Also verify:

```text
pause
resume
restart
failure
invalid origin
stale session
```

---

# Build and packaging

Start as a normal public GitHub repository.

During early protocol development, consumers may use tagged GitHub versions.

Do not depend on a moving branch such as:

```text
main
```

Use tags:

```text
v0.1.0
v0.2.0
...
```

After both the WHS shell and at least two real games successfully use the SDK, freeze Protocol v1 and publish the SDK publicly to npm.

Target package naming:

```text
@whs/game-bridge
```

or the closest available organization scope.

Do not use GitHub Packages unless there is a later concrete need for private distribution.

The browser implementation is inherently inspectable, so package privacy is not a security boundary.

---

# Explicit non-goals

Do not implement:

- authentication
- user profiles
- bookmarks
- progress database
- PostHog SDK
- payments
- sponsorship
- game UI
- shell UI
- asset hosting
- game discovery
- React integrations
- Three.js integrations
- game-engine-specific adapters

Keep the package narrow.

---

# Definition of done for Protocol v1

Protocol v1 is ready for WHS integration when:

1. Game and host SDK APIs exist.
2. All protocol messages have runtime validation.
3. Origin and session validation exist.
4. Mock game exists.
5. Full handshake works in real browser tests.
6. Pause/resume/restart work.
7. Checkpoint/completion/failure work.
8. Invalid messages cannot alter session state.
9. README documents installation and a minimal integration.
10. A tagged prerelease can be consumed by the WHS repository.

Do not publish `1.0.0` yet.

Use `0.x` versions until the WHS shell and at least two games have exercised the protocol.