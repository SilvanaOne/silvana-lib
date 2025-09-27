import { describe, it } from "node:test";
import { AppInstanceManager } from "../src/app_instance.js";

const APP_INSTANCE_ADDRESS = "0x64f37f8d45d102681bde880543a0ab3622647a1c494c9905dbdefdf0fc563182";
const REGISTRY_ADDRESS = process.env.SILVANA_REGISTRY_ADDRESS;

describe("App Instance", async () => {
  it("should fetch and print app instance", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - SILVANA_REGISTRY_ADDRESS env var required"
      );
    }

    const manager = new AppInstanceManager({
      registry: REGISTRY_ADDRESS,
    });

    console.log(`Fetching app instance: ${APP_INSTANCE_ADDRESS}`);
    const appInstance = await manager.getAppInstance(APP_INSTANCE_ADDRESS);

    if (!appInstance) {
      console.log("App instance not found");
      return;
    }

    console.log("\n=== App Instance Details ===");
    console.log(`ID: ${appInstance.id}`);
    console.log(`Silvana App Name: ${appInstance.silvanaAppName}`);
    console.log(`Description: ${appInstance.description ?? "N/A"}`);
    console.log(`Admin: ${appInstance.admin}`);
    console.log(`Sequence: ${appInstance.sequence}`);
    console.log(`Block Number: ${appInstance.blockNumber}`);
    console.log(`Previous Block Timestamp: ${appInstance.previousBlockTimestamp}`);
    console.log(`Previous Block Last Sequence: ${appInstance.previousBlockLastSequence}`);
    console.log(`Last Proved Block Number: ${appInstance.lastProvedBlockNumber}`);
    console.log(`Last Settled Block Number: ${appInstance.lastSettledBlockNumber}`);
    console.log(`Last Settled Sequence: ${appInstance.lastSettledSequence}`);
    console.log(`Last Purged Sequence: ${appInstance.lastPurgedSequence}`);
    console.log(`Is Paused: ${appInstance.isPaused}`);
    console.log(`Min Time Between Blocks: ${appInstance.minTimeBetweenBlocks}`);
    console.log(`Jobs ID: ${appInstance.jobsId}`);
    console.log(`Created At: ${appInstance.createdAt}`);
    console.log(`Updated At: ${appInstance.updatedAt}`);

    console.log("\n=== Metadata ===");
    if (Object.keys(appInstance.metadata).length > 0) {
      console.log(JSON.stringify(appInstance.metadata, null, 2));
    } else {
      console.log("No metadata");
    }

    console.log("\n=== KV Store ===");
    if (Object.keys(appInstance.kv).length > 0) {
      console.log(JSON.stringify(appInstance.kv, null, 2));
    } else {
      console.log("No KV data");
    }

    console.log("\n=== Methods ===");
    if (Object.keys(appInstance.methods).length > 0) {
      for (const [methodName, method] of Object.entries(appInstance.methods)) {
        console.log(`\n${methodName}:`);
        console.log(`  Description: ${method.description ?? "N/A"}`);
        console.log(`  Developer: ${method.developer}`);
        console.log(`  Agent: ${method.agent}`);
        console.log(`  Agent Method: ${method.agentMethod}`);
      }
    } else {
      console.log("No methods");
    }

    console.log("\n=== Full Object ===");
    console.log(JSON.stringify(appInstance, null, 2));
  });
});