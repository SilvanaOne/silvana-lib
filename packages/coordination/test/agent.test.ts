import { describe, it } from "node:test";
import assert from "node:assert";

import { AgentRegistry } from "../src/agent.js";
import { executeTx, waitTx } from "../src/execute.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const REGISTRY_NAME = "Silvana Agent Registry Testnet";
const REGISTRY_ADDRESS =
  "0x74e2b7e5514355a8255fccaac571ad4e0a9315b8e479e2d10adfcce113c2082d";
const create = false;

describe("Agent Registry", async () => {
  it.skip("should create agent registry", async () => {
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
    if (result?.digest) await waitTx(result.digest);
  });
  it("should create developer", { skip: !create }, async () => {
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
    if (result?.digest) await waitTx(result.digest);
  });
  it("should create agent", { skip: !create }, async () => {
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
      docker_image: "dfstio/testagent4:latest",
      min_memory_gb: 8,
      min_cpu_cores: 4,
      supports_tee: false,
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
    if (result?.digest) await waitTx(result.digest);
  });
  it("should update developer", { skip: !create }, async () => {
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
    if (result?.digest) await waitTx(result.digest);
  });
  it("should update agent", { skip: !create }, async () => {
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
      docker_image: "dfstio/testagent4:latest",
      min_memory_gb: 8,
      min_cpu_cores: 4,
      supports_tee: false,
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
    if (result?.digest) await waitTx(result.digest);
  });
  it.skip("should remove agent", async () => {
    console.log("removing agent on chain", process.env.SUI_CHAIN);
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
    const tx = registry.removeAgent({
      developer: "DFST",
      agent: "Test Agent 4",
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    if (result?.digest) await waitTx(result.digest);
  });
  it.skip("should remove developer", async () => {
    console.log("removing developer on chain", process.env.SUI_CHAIN);
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
    const tx = registry.removeDeveloper({
      name: "DFST",
      agentNames: ["Test Agent 5"],
    });
    tx.setSender(address);
    tx.setGasBudget(100_000_000);
    const result = await executeTx({
      tx,
      keyPair,
    });
    console.log("Result", result);
    console.log("Objects:", result?.tx?.objectChanges);
    if (result?.digest) await waitTx(result.digest);
  });
  it("should get developer", async () => {
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const developer = await registry.getDeveloper({ name: "DFST" });
    console.log("Developer", developer);
  });
  it.skip("should get developer names", async () => {
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
  });
  it.skip("should get agent", async () => {
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    const agent = await registry.getAgent({
      developer: "DFST",
      agent: "Test Agent 4",
    });
    console.log("Agent", agent);
  });

  it.skip("should get docker image details", async () => {
    const detailsNonTEE = await AgentRegistry.getDockerImageDetails({
      dockerImage: "dfstio/testagent4:latest",
    });
    console.log("Non-TEE Docker Image Details", detailsNonTEE);
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
    /*
      For TEE should be 1 layer
        TEE Docker Image Details {
          sha256: '29d43dc19cc2f9c7432515d170b6cb822feaa71451f7a4942b179a0f5c8d9c4b',
          numberOfLayers: 1
        }
      */
  });
});
