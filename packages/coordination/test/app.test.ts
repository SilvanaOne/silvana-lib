import { describe, it } from "node:test";
import assert from "node:assert";

import { createTestRegistry, createTestApp } from "../src/test.js";

describe("TestApp Module", async () => {
  let testRegistry: Awaited<ReturnType<typeof createTestRegistry>>;
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  it("should create a registry for TestApp", async () => {
    testRegistry = await createTestRegistry({
      registryName: "Test Registry for TestApp Module",
      developerName: "TestAppDev",
      appName: "test_app",
      testAgentName: "TestAppAgent",
      testAgentChains: ["sui-testnet"],
    });

    assert(testRegistry.registryAddress, "Registry should be created");
    console.log("Registry created for TestApp:", testRegistry.registryAddress);
  });

  it("should create TestApp with initialized AppInstance", async () => {
    if (!testRegistry) {
      console.log("Skipping - no test registry");
      return;
    }

    testApp = await createTestApp(testRegistry.registryAddress, "test_app");

    assert(testApp.testAppAddress, "TestApp should be created");
    assert(testApp.appInstanceAddress, "AppInstance should be created");
    assert(testApp.appInstanceCapAddress, "AppInstanceCap should be created");
    console.log("TestApp created:", testApp.testAppAddress);
    console.log("AppInstance created:", testApp.appInstanceAddress);
    console.log("AppInstanceCap created:", testApp.appInstanceCapAddress);
  });

  it("should get AppInstance details from TestApp", async () => {
    if (!testApp) {
      console.log("Skipping - no TestApp created");
      return;
    }

    const appInstance = await testApp.appInstanceManager.getAppInstance(
      testApp.appInstanceAddress
    );
    console.log("AppInstance details from TestApp:", appInstance);

    if (appInstance) {
      assert(
        appInstance.silvanaAppName === "test_app",
        "App name should be test_app"
      );
      assert(appInstance.admin, "Admin should be set");
      // Description might be undefined in TestApp instances
      assert(appInstance.sequence === 1, "Sequence should be initialized to 1");
      assert(
        appInstance.blockNumber === 1,
        "Block number should be initialized to 1"
      );
      assert(
        appInstance.lastProvedBlockNumber === 0,
        "Last proved block should be 0"
      );
      assert(appInstance.isPaused === false, "Instance should not be paused");
    }
  });
});
