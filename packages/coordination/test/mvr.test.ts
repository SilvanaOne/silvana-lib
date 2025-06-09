import { describe, it } from "node:test";
import assert from "node:assert";

describe("MVR", async () => {
  it("should publish to MVR", async () => {
    console.log("publishing to MVR on chain", process.env.SUI_CHAIN);
  });
});
