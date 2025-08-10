import { describe, it } from "node:test";
import assert from "node:assert";

import { createTestRegistry, createTestAppInstance } from "../src/test.js";
import { executeTx, waitTx } from "../src/execute.js";

describe("App Instance Manager", async () => {
  let testRegistry: Awaited<ReturnType<typeof createTestRegistry>>;
  let appInstanceId: string | undefined;
  
  it("should create test registry with app", async () => {
    testRegistry = await createTestRegistry({
      registryName: "Test Registry for App Instance",
      developerName: "AppTestDev",
      appName: "AppTestApp",
      testAgentName: "AppTestAgent",
      testAgentChains: ["sui-testnet", "sui-devnet"], // This will create an agent too
    });
    
    assert(testRegistry.registryAddress, "Registry should be created");
    assert(testRegistry.registry, "Registry instance should be available");
    assert(testRegistry.appInstanceManager, "App instance manager should be available");
  });
  
  it("should create an app instance", async () => {
    if (!testRegistry) {
      console.log("Skipping - no test registry");
      return;
    }
    
    appInstanceId = await createTestAppInstance(
      testRegistry, 
      "Test app instance for testing",
      "https://test.app.com"
    );
    
    assert(appInstanceId, "App instance should be created");
  });

  it("should add a method to app instance", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    console.log("Adding method to app instance");
    
    const tx = testRegistry.appInstanceManager.addMethod({
      appInstance: appInstanceId,
      name: "processData",
      description: "Process incoming data through agent",
      developer: testRegistry.developerName,
      agent: testRegistry.agentName || "TestAgent",
      agentMethod: "process",
    });
    
    tx.setSender(testRegistry.address);
    tx.setGasBudget(100_000_000);
    
    const result = await executeTx({
      tx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Add method result:", result?.digest);
    if (result?.digest) await waitTx(result.digest);
  });



  it("should create an app job", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    console.log("Creating app job");
    
    const tx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Process batch data",
      method: "processData",
      sequences: [1, 2, 3],
      data: new Uint8Array([10, 20, 30, 40, 50]),
    });
    
    tx.setSender(testRegistry.address);
    tx.setGasBudget(100_000_000);
    
    const result = await executeTx({
      tx,
      keyPair: testRegistry.keyPair,
    });
    console.log("Create job result:", result?.digest);
    if (result?.digest) await waitTx(result.digest);
  });

  it("should get app instance details", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    const appInstance = await testRegistry.appInstanceManager.getAppInstance(appInstanceId);
    console.log("App instance details:", appInstance);
    
    if (appInstance) {
      assert(appInstance.silvanaAppName === testRegistry.appName, "App name should match");
      assert(appInstance.admin, "Admin should be set");
      assert(appInstance.description === "Test app instance for testing", "Description should match");
      assert(appInstance.metadata === "https://test.app.com", "URL/metadata should match");
      assert(appInstance.methods.processData, "Method should exist");
      assert(appInstance.methods.processData.agentMethod === "process", "Method should exist");
      assert(appInstance.sequence > 0, "Sequence should be initialized");
      assert(appInstance.blockNumber > 0, "Block number should be initialized");
    }
  });

  it("should get app pending jobs", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(appInstanceId);
    console.log("App pending jobs:", pendingJobs);
    assert(Array.isArray(pendingJobs), "Should return array of pending jobs");
    assert(pendingJobs.length > 0, "Should have at least one pending job");
  });

  it("should start app job", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    console.log("Starting app job");
    
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(appInstanceId);
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
    console.log("Start job result:", result?.digest);
    if (result?.digest) await waitTx(result.digest);
  });

  it("should get app job details", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    // Job IDs start from 1, not 0
    const job = await testRegistry.appInstanceManager.getAppJob({
      appInstance: appInstanceId,
      jobId: 1,
    });
    console.log("App job details:", job);
    
    assert(job, "Job should exist");
    assert(job.appInstanceMethod === "processData", "Method should be processData");
    assert(job.status.type === "Running", "Job should be running");
    assert(job.developer === testRegistry.developerName, "Developer should match");
    assert(job.agent === (testRegistry.agentName || "AppTestAgent"), "Agent should match");
    assert(job.agentMethod === "process", "Agent method should match");
    assert(job.data.length === 5, "Data should have 5 bytes");
    assert(job.sequences?.length === 3, "Should have 3 sequences");
  });

  it("should fail app job", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    console.log("Creating a new job to fail");
    
    // Create a new job specifically for failing
    const createTx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Job to be failed",
      method: "processData",
      data: new Uint8Array([100, 101, 102]),
    });
    
    createTx.setSender(testRegistry.address);
    createTx.setGasBudget(100_000_000);
    
    const createResult = await executeTx({
      tx: createTx,
      keyPair: testRegistry.keyPair,
    });
    assert(createResult, "Job creation should succeed");
    
    // Get the pending jobs to find the new job ID
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    assert(pendingJobs.length > 0, "Should have pending jobs");
    
    const jobToFail = pendingJobs[pendingJobs.length - 1]; // Get the latest job
    console.log("Starting job", jobToFail, "before failing it");
    
    // Start the job first (jobs can only be failed from Running state)
    const startTx = testRegistry.appInstanceManager.startAppJob({
      appInstance: appInstanceId,
      jobId: jobToFail,
    });
    
    startTx.setSender(testRegistry.address);
    startTx.setGasBudget(100_000_000);
    
    const startResult = await executeTx({
      tx: startTx,
      keyPair: testRegistry.keyPair,
    });
    assert(startResult, "Start job should succeed");
    
    // Now fail the running job
    console.log("Failing job", jobToFail);
    const failTx = testRegistry.appInstanceManager.failAppJob({
      appInstance: appInstanceId,
      jobId: jobToFail,
      error: "Test failure - simulated error",
    });
    
    failTx.setSender(testRegistry.address);
    failTx.setGasBudget(100_000_000);
    
    const failResult = await executeTx({
      tx: failTx,
      keyPair: testRegistry.keyPair,
    });
    assert(failResult, "Fail job should succeed");
    console.log("Fail job result:", failResult?.digest);
    if (failResult?.digest) await waitTx(failResult.digest);
    
    // According to the Move code, when a job fails and hasn't reached max attempts,
    // it goes back to Pending state for retry. After max attempts, it's deleted.
    // Since default max_attempts is 3 and this is the first attempt, it should be back to Pending
    const pendingJobsAfterFail = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    assert(
      pendingJobsAfterFail.includes(jobToFail),
      "Job should be back in pending for retry after first failure"
    );
  });

  it("should complete app job", async () => {
    if (!appInstanceId || !testRegistry) {
      console.log("Skipping - no app instance or registry");
      return;
    }
    
    // Create a new job to complete
    console.log("Creating another job to complete");
    const createTx = testRegistry.appInstanceManager.createAppJob({
      appInstance: appInstanceId,
      description: "Job to complete",
      method: "processData",
      data: new Uint8Array([1, 2, 3]),
    });
    
    createTx.setSender(testRegistry.address);
    createTx.setGasBudget(100_000_000);
    
    const createResult = await executeTx({
      tx: createTx,
      keyPair: testRegistry.keyPair,
    });
    assert(createResult, "Job creation should succeed");
    
    // Get the pending jobs to find the new job ID
    const pendingJobs = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    assert(pendingJobs.length > 0, "Should have pending jobs");
    
    const jobToComplete = pendingJobs[pendingJobs.length - 1]; // Get the latest job
    console.log("Starting job", jobToComplete);
    
    // Start the job
    const startTx = testRegistry.appInstanceManager.startAppJob({
      appInstance: appInstanceId,
      jobId: jobToComplete,
    });
    
    startTx.setSender(testRegistry.address);
    startTx.setGasBudget(100_000_000);
    
    const startResult = await executeTx({
      tx: startTx,
      keyPair: testRegistry.keyPair,
    });
    assert(startResult, "Start job should succeed");
    
    // Complete the job
    console.log("Completing app job", jobToComplete);
    const completeTx = testRegistry.appInstanceManager.completeAppJob({
      appInstance: appInstanceId,
      jobId: jobToComplete,
    });
    
    completeTx.setSender(testRegistry.address);
    completeTx.setGasBudget(100_000_000);
    
    const completeResult = await executeTx({
      tx: completeTx,
      keyPair: testRegistry.keyPair,
    });
    assert(completeResult, "Complete job should succeed");
    console.log("Complete job result:", completeResult?.digest);
    if (completeResult?.digest) await waitTx(completeResult.digest);
    
    // Job should be deleted after completion, so it should not exist anymore
    const completedJob = await testRegistry.appInstanceManager.getAppJob({
      appInstance: appInstanceId,
      jobId: jobToComplete,
    });
    assert(!completedJob, "Job should be deleted after completion");
    
    // Should not be in pending jobs anymore
    const pendingJobsAfter = await testRegistry.appInstanceManager.getAppPendingJobs(
      appInstanceId
    );
    assert(
      !pendingJobsAfter.includes(jobToComplete),
      "Completed job should not be in pending jobs"
    );
  });


});