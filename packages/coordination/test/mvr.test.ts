import { describe, it } from "node:test";
import assert from "node:assert";

import { publishToMVR, publishCodeToMVR } from "../src/mvr.js";
import { executeTx } from "../src/execute.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const UPGRADE_CAP =
  "0x5be8662ac9e1ada2e56a5ce76e433dffa2b9b2e636451892e14a4a91a63173ea";
const PACKAGE_NAME = "Silvana Agent Registry V4";
const MVR_NAME = "@silvana/agent";
const SAFE_ADDRESS =
  "0xb11e20ecdc1ddaccde1d84b865100cc8d549e780dc8394ca9c982218f93d108d";

describe("MVR", async () => {
  it("should publish to MVR", async () => {
    console.log("publishing to MVR on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const tx = publishToMVR({
      upgradeCap: UPGRADE_CAP,
      packageName: PACKAGE_NAME,
      mvrName: MVR_NAME,
      safeAddress: SAFE_ADDRESS,
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    // Package metadata is now published to MVR: 0x69e25c23e57970bef33268f5692ebb252747c2a2a23936c6a4b4ff261961948b
  });
});
