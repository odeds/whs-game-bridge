import { describe, expect, it } from "vitest";
import * as sdk from "@whs/game-bridge";

describe("built root package API", () => {
  it("exports the documented runtime API from the package root", () => {
    expect(sdk.PROTOCOL).toBe("whs");
    expect(sdk.PROTOCOL_VERSION).toBe(1);
    expect(sdk.gameCapabilities).toEqual(["pause", "restart", "checkpoint", "volume"]);
    expect(sdk.hasGameCapability(["pause"], "pause")).toBe(true);
    expect(sdk.createGameBridge).toBeTypeOf("function");
    expect(sdk.createGameHost).toBeTypeOf("function");
    expect(sdk.gameMessageTypes).toContain("whs.game.checkpoint");
    expect(sdk.shellMessageTypes).toContain("whs.shell.set-volume");
  });
});
