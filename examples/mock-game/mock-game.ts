import { createGameBridge, type ShellMessage } from "@whs/game-bridge";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
}

const parentOrigin = new URLSearchParams(location.search).get("parentOrigin");
if (!parentOrigin) throw new Error("parentOrigin query parameter is required");

const bridge = createGameBridge({
  gameId: "mock-game",
  parentOrigin,
  capabilities: ["pause", "restart", "checkpoint", "volume"],
});
const refresh = () => {
  element("state").textContent = bridge.state;
  element("session").textContent = bridge.sessionId || "—";
};
const sent = (type: string) => {
  element("sent").textContent = type;
  refresh();
};
const received = (message: ShellMessage | string, reaction: string) => {
  element("received").textContent = typeof message === "string" ? message : JSON.stringify(message);
  element("reaction").textContent = reaction;
  refresh();
};

bridge.onInitialize((message) => received(message, "INITIALIZE received"));
bridge.onStart(() => received("whs.shell.start", "START received"));
bridge.onPause(() => received("whs.shell.pause", "PAUSE received"));
bridge.onResume(() => received("whs.shell.resume", "RESUME received"));
bridge.onRestart(() => received("whs.shell.restart", "RESTART received"));
bridge.onSetVolume((volume) => received("whs.shell.set-volume", `Volume ${volume}`));

element<HTMLButtonElement>("ready").onclick = async () => {
  if (bridge.state !== "new") return;
  const ready = bridge.ready();
  sent("whs.game.ready");
  try {
    await ready;
  } catch (error) {
    element("reaction").textContent = error instanceof Error ? error.message : String(error);
  }
  refresh();
};
element<HTMLButtonElement>("started").onclick = () => {
  if (bridge.state !== "starting") return;
  bridge.started();
  sent("whs.game.started");
};
element<HTMLButtonElement>("checkpoint").onclick = () => {
  if (bridge.state !== "started" && bridge.state !== "paused") return;
  bridge.checkpoint({ checkpoint: "wave-2" });
  sent("whs.game.checkpoint");
};
element<HTMLButtonElement>("complete").onclick = () => {
  if (bridge.state !== "started" && bridge.state !== "paused") return;
  bridge.completed({ score: 1250 });
  sent("whs.game.completed");
};
element<HTMLButtonElement>("fail").onclick = () => {
  if (bridge.state !== "started" && bridge.state !== "paused") return;
  bridge.failed({ reason: "player-defeated" });
  sent("whs.game.failed");
};
element<HTMLButtonElement>("error").onclick = () => {
  if (!["initialized", "starting", "started", "paused"].includes(bridge.state)) return;
  bridge.error({ message: "mock error", code: "MOCK" });
  sent("whs.game.error");
};

refresh();
