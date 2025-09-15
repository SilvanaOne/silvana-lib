import { describe, it } from "node:test";
import assert from "node:assert";

import { AgentRegistry } from "../src/agent.js";
import { executeTx, waitTx } from "../src/execute.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const REGISTRY_NAME = "Silvana Agent Registry Testnet";
let REGISTRY_ADDRESS: string | undefined = process.env.SILVANA_REGISTRY_ADDRESS;
const create = true;

describe("Agent Registry", async () => {
  it("should create agent registry", { skip: !create }, async () => {
    console.log("creating agent registry on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const tx = AgentRegistry.createAgentRegistry({
      name: REGISTRY_NAME,
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);

    // Assert transaction was successful
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    assert(result.tx.objectChanges, "Transaction should have object changes");

    // Find the created registry object
    const registryObject = result.tx.objectChanges.find(
      (obj: any) =>
        obj.type === "created" &&
        obj.objectType?.includes("::registry::SilvanaRegistry")
    );
    
    assert(registryObject, "Registry object should be created");
    assert("objectId" in registryObject, "Registry object should have an objectId");
    
    REGISTRY_ADDRESS = registryObject.objectId;
    console.log("Registry created with address:", REGISTRY_ADDRESS);

    await waitTx(result.digest);

    assert(REGISTRY_ADDRESS, "Registry address should be set after creation");
  });
  it("should create developer", { skip: !create }, async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("creating developer on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const tx = registry.createDeveloper({
      name: "DFST",
      developerOwner: address,
      github: "dfstio",
      image:
        "https://www.dfst.io/static/177f6f30ec66924986c36f0920d5a667/15f29/defi-logo.webp",
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should create agent", { skip: !create }, async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("creating agent on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const tx = registry.createAgent({
      developer: "DFST",
      name: "Test Agent 4",
      image: "https://example.com/agent-logo.png",
      description: "Test agent for coordination",
      chains: ["sui-mainnet", "sui-testnet"],
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should update developer", { skip: !create }, async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("updating developer on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const tx = registry.updateDeveloper({
      name: "DFST",
      github: "dfstio",
      description: undefined,
      image:
        "https://www.dfst.io/static/177f6f30ec66924986c36f0920d5a667/15f29/defi-logo.webp",
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should update agent", { skip: !create }, async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("updating agent on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const tx = registry.updateAgent({
      developer: "DFST",
      name: "Test Agent 4",
      image: "https://example.com/agent-logo-updated.png",
      description: "Updated test agent for coordination",
      chains: ["sui-mainnet", "sui-testnet", "sui-devnet"],
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should create and remove test agent", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("creating and removing agent on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    
    // First create an agent specifically for removal
    console.log("Creating agent for removal test");
    const createTx = registry.createAgent({
      developer: "DFST",
      name: "Test Agent To Remove",
      image: "https://example.com/agent-to-remove.png",
      description: "Agent created for removal test",
      chains: ["sui-testnet"],
    });
    createTx.setSender(address);
    createTx.setGasBudget(100_000_000);
    
    const createResult = await executeTx({
      tx: createTx,
      keyPair,
    });
    
    assert(createResult, "Creation of agent for removal should succeed");
    assert(createResult.digest, "Creation should have a digest");
    await waitTx(createResult.digest);
    
    // Now remove the agent we just created
    console.log("Removing the created agent");
    const tx = registry.removeAgent({
      developer: "DFST",
      agent: "Test Agent To Remove",
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should create and remove test developer", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    console.log("creating and removing developer on chain", process.env.SUI_CHAIN);
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("sender address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    
    // First create a developer specifically for removal
    console.log("Creating developer for removal test");
    const createTx = registry.createDeveloper({
      name: "TestDevToRemove",
      developerOwner: address,
      github: "testdevremove",
      image: "https://example.com/dev-to-remove.png",
      description: "Developer created for removal test",
    });
    createTx.setSender(address);
    createTx.setGasBudget(100_000_000);
    
    const createResult = await executeTx({
      tx: createTx,
      keyPair,
    });
    
    assert(createResult, "Creation of developer for removal should succeed");
    assert(createResult.digest, "Creation should have a digest");
    await waitTx(createResult.digest);
    
    // Now remove the developer we just created
    console.log("Removing the created developer");
    const tx = registry.removeDeveloper({
      name: "TestDevToRemove",
      agentNames: [], // No agents for this test developer
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    
    assert(result, "Transaction execution should return a result (check logs for errors)");
    assert(result.tx, "Transaction result should contain tx data");
    assert(result.digest, "Transaction should have a digest");
    
    await waitTx(result.digest);
  });
  it("should get developer", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const developer = await registry.getDeveloper({ name: "DFST" });
    console.log("Developer", developer);
    assert(developer, "Developer should be retrieved");
    assert(developer.name === "DFST", "Developer name should match");
    assert(developer.github === "dfstio", "Developer github should match");
  });
  it("should get developer names", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    console.log("developer address", address);
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const developerNames = await registry.getDeveloperNames({
      developerAddress: address,
    });
    console.log("Developer Names", developerNames);
    assert(developerNames, "Developer names should be retrieved");
    assert(Array.isArray(developerNames.names), "Developer names should be an array");
    assert(developerNames.names.includes("DFST"), "Developer names should include DFST");
  });
  it("should create and get agent", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - run create registry test first"
      );
    }
    const key = process.env.SUI_KEY;
    if (!key) {
      throw new Error("SUI_KEY is not set");
    }
    const keyPair = Ed25519Keypair.fromSecretKey(key);
    const address = keyPair.toSuiAddress();
    
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    
    // Create a new agent specifically for the get test
    console.log("Creating Test Agent For Get");
    const createTx = registry.createAgent({
      developer: "DFST",
      name: "Test Agent For Get",
      image: "https://example.com/agent-for-get.png",
      description: "Agent created for get test",
      chains: ["sui-mainnet", "sui-testnet", "sui-devnet"],
    });
    createTx.setSender(address);
    createTx.setGasBudget(100_000_000);
    
    const createResult = await executeTx({
      tx: createTx,
      keyPair,
    });
    
    assert(createResult, "Creation of Test Agent For Get should succeed");
    assert(createResult.digest, "Creation should have a digest");
    await waitTx(createResult.digest);
    
    // Now get the agent we just created
    const agent = await registry.getAgent({
      developer: "DFST",
      agent: "Test Agent For Get",
    });
    
    console.log("Agent retrieved:", agent);
    assert(agent, "Agent should be retrieved after creation");
    assert(agent.name === "Test Agent For Get", "Agent name should match");
    assert(agent.chains.includes("sui-mainnet"), "Agent should support sui-mainnet");
    assert(agent.chains.includes("sui-testnet"), "Agent should support sui-testnet");
    assert(agent.chains.includes("sui-devnet"), "Agent should support sui-devnet");
  });

  it("should get docker image details", async () => {
    const detailsNonTEE = await AgentRegistry.getDockerImageDetails({
      dockerImage: "dfstio/testagent4:latest",
    });
    console.log("Non-TEE Docker Image Details", detailsNonTEE);
    assert(detailsNonTEE, "Non-TEE docker image details should be retrieved");
    assert(detailsNonTEE.sha256, "Non-TEE docker image should have sha256 hash");
    assert(typeof detailsNonTEE.numberOfLayers === "number", "Non-TEE docker image should have number of layers");
    assert(detailsNonTEE.numberOfLayers > 0, "Non-TEE docker image should have at least 1 layer");
    /*
    For non-TEE can be any number of layers
        Non-TEE Docker Image Details {
          sha256: '1fd2cc04017996215c2bf28df7ccd0f6f05fa2629c805e0f3096ffeca25c8c9d',
          numberOfLayers: 10
        }
    */

    const detailsTEE = await AgentRegistry.getDockerImageDetails({
      dockerImage: "dfstio/testagent4:flat-amd64",
    });
    console.log("TEE Docker Image Details", detailsTEE);
    assert(detailsTEE, "TEE docker image details should be retrieved");
    assert(detailsTEE.sha256, "TEE docker image should have sha256 hash");
    assert(detailsTEE.numberOfLayers === 1, "TEE docker image should have exactly 1 layer for flat format");
    /*
      For TEE should be 1 layer
        TEE Docker Image Details {
          sha256: '29d43dc19cc2f9c7432515d170b6cb822feaa71451f7a4942b179a0f5c8d9c4b',
          numberOfLayers: 1
        }
      */
  });
});
