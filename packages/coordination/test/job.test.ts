import { describe, it } from "node:test";
import assert from "node:assert";

import { createTestRegistry, createTestAppInstance } from "../src/test.js";
import { executeTx, waitTx } from "../src/execute.js";

describe("Job Manager", async () => {
  let testRegistry: Awaited<ReturnType<typeof createTestRegistry>>;
  let appInstanceId: string | undefined;

  it("should create test setup with app instance", async () => {
    console.log(
      "creating test registry and app instance on chain",
      process.env.SUI_CHAIN
    );

    testRegistry = await createTestRegistry({
      registryName: "Test Registry for Jobs",
      developerName: "JobTestDev",
      appName: "JobTestApp",
      testAgentName: "JobTestAgent",
      testAgentChains: ["sui-testnet"],
    });

    assert(testRegistry.registryAddress, "Registry should be created");

    // Create an app instance which includes a Jobs container
    appInstanceId = await createTestAppInstance(
      testRegistry,
      "Test app instance for job testing",
      "https://test.job.app"
    );

    assert(appInstanceId, "App instance should be created");

    console.log("Test setup complete, app instance:", appInstanceId);
  });

  it("should add method and create a job via app instance", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    console.log("Adding method to app instance");

    // First add a method to the app instance
    const addMethodTx = testRegistry.appInstanceManager.addMethod({
      appInstance: appInstanceId,
      name: "processJob",
      description: "Process job data",
      developer: testRegistry.developerName,
      agent: testRegistry.agentName || "JobTestAgent",
      agentMethod: "process",
    });

    addMethodTx.setSender(testRegistry.address);
    addMethodTx.setGasBudget(100_000_000);

    await executeTx({
      tx: addMethodTx,
      keyPair: testRegistry.keyPair,
    });

    console.log("Creating job via app instance");

    // Create a job through the app instance
    const tx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Test job for processing data",
      method: "processJob",
      sequences: [1, 2, 3],
      data: new Uint8Array([1, 2, 3, 4, 5]),
    });

    tx.setSender(testRegistry.address);
    tx.setGasBudget(100_000_000);

    const result = await executeTx({
      tx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Result", result);
    if (result?.digest) await waitTx(result.digest);
  });

  it("should get pending jobs", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    console.log("Pending jobs:", pendingJobs);
    assert(Array.isArray(pendingJobs), "Should return array of pending jobs");
    assert(pendingJobs.length > 0, "Should have at least one pending job");
  });

  it("should get next pending job", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    const nextJob = pendingJobs.length > 0 ? pendingJobs[0] : undefined;
    console.log("Next pending job:", nextJob);
    assert(nextJob !== undefined, "Should have a pending job");
  });

  it("should start a job", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    console.log("starting job on chain", process.env.SUI_CHAIN);

    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );

    if (pendingJobs.length === 0) {
      console.log("No pending jobs to start");
      return;
    }

    const tx = testRegistry.appInstanceManager.startAppJob({
      appInstance: appInstanceId,
      jobId: pendingJobs[0],
    });
    tx.setSender(testRegistry.address);
    tx.setGasBudget(100_000_000);

    const result = await executeTx({
      tx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Result", result);
    if (result?.digest) await waitTx(result.digest);
  });

  it("should get a specific job", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    const job = await testRegistry.appInstanceManager.getAppJob({
      appInstance: appInstanceId,
      jobId: 1, // Job IDs start from 1
    });
    console.log("Job details:", job);

    assert(job, "Job should exist");
    assert(Number(job.jobId) === 1, "Job ID should be 1");
    assert(
      job.developer === testRegistry.developerName,
      "Developer should match"
    );
    assert(
      job.agent === (testRegistry.agentName || "JobTestAgent"),
      "Agent should match"
    );
    assert(job.agentMethod === "process", "Agent method should be process");
    assert(job.status.type === "Running", "Job should be running");
    assert(job.data.length === 5, "Data should have 5 bytes");
    assert(job.sequences?.length === 3, "Should have 3 sequences");
  });

  it("should fail a job", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    console.log("Creating a new job to fail on chain", process.env.SUI_CHAIN);
    
    // Create a new job specifically for failing
    const createTx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Job to be failed",
      method: "processJob",
      data: new Uint8Array([5, 6, 7]),
    });

    createTx.setSender(testRegistry.address);
    createTx.setGasBudget(100_000_000);

    await executeTx({
      tx: createTx,
      keyPair: testRegistry.keyPair,
    });

    // Get the pending jobs to find the new job ID
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    
    if (pendingJobs.length === 0) {
      console.log("No pending jobs to fail");
      return;
    }

    const jobToFail = pendingJobs[pendingJobs.length - 1]; // Get the latest job
    console.log("Starting job", jobToFail, "before failing it");

    // Start the job first (jobs can only be failed from Running state)
    const startTx = testRegistry.appInstanceManager.startAppJob({
      appInstance: appInstanceId,
      jobId: jobToFail,
    });

    startTx.setSender(testRegistry.address);
    startTx.setGasBudget(100_000_000);

    await executeTx({
      tx: startTx,
      keyPair: testRegistry.keyPair,
    });

    // Now fail the running job
    console.log("Failing job", jobToFail);
    const tx = testRegistry.appInstanceManager.failAppJob({
      appInstance: appInstanceId,
      jobId: jobToFail,
      error: "Test failure - connection timeout",
    });

    tx.setSender(testRegistry.address);
    tx.setGasBudget(100_000_000);

    const result = await executeTx({
      tx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Result", result);
    if (result?.digest) await waitTx(result.digest);

    console.log("Job failed successfully");
  });

  it("should complete a job", async () => {
    if (!appInstanceId || !testRegistry) {
      throw new Error("App instance not found");
    }

    console.log("Creating and completing a new job");

    // Create a new job
    const createTx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Job to complete",
      method: "processJob",
      data: new Uint8Array([10, 20, 30]),
    });

    createTx.setSender(testRegistry.address);
    createTx.setGasBudget(100_000_000);

    await executeTx({
      tx: createTx,
      keyPair: testRegistry.keyPair,
    });

    // Get the pending jobs to find the new job ID
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    
    if (pendingJobs.length === 0) {
      console.log("No pending jobs to complete");
      return;
    }

    const jobToComplete = pendingJobs[pendingJobs.length - 1]; // Get the latest job
    console.log("Starting job", jobToComplete);

    // Start the job
    const startTx = testRegistry.appInstanceManager.startAppJob({
      appInstance: appInstanceId,
      jobId: jobToComplete,
    });

    startTx.setSender(testRegistry.address);
    startTx.setGasBudget(100_000_000);

    await executeTx({
      tx: startTx,
      keyPair: testRegistry.keyPair,
    });

    // Complete the job
    console.log("Completing job", jobToComplete);
    const completeTx = testRegistry.appInstanceManager.completeAppJob({
      appInstance: appInstanceId,
      jobId: jobToComplete,
    });

    completeTx.setSender(testRegistry.address);
    completeTx.setGasBudget(100_000_000);

    const result = await executeTx({
      tx: completeTx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Complete job result:", result?.digest);
    if (result?.digest) await waitTx(result.digest);
  });
});
