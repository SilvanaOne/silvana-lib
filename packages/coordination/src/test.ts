import { AgentRegistry } from "./agent.js";
import { AppInstanceManager } from "./app_instance.js";
import { executeTx, waitTx } from "./execute.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

export interface TestRegistryConfig {
  registryName?: string;
  developerName?: string;
  developerGithub?: string;
  developerImage?: string;
  developerDescription?: string;
  developerSite?: string;
  appName?: string;
  appDescription?: string;
  appImage?: string;
  appSite?: string;
  testAgentName?: string;
  testAgentImage?: string;
  testAgentChains?: string[];
}

export interface TestRegistryResult {
  registryAddress: string;
  developerName: string;
  appName: string;
  agentName?: string;
  registry: AgentRegistry;
  appInstanceManager: AppInstanceManager;
  keyPair: Ed25519Keypair;
  address: string;
}

/**
 * Creates a test Silvana Registry with a test developer, app, and optionally an agent
 * This is a helper function for testing that sets up a complete test environment
 */
export async function createTestRegistry(
  config: TestRegistryConfig = {}
): Promise<TestRegistryResult> {
  // Default values
  const registryName = config.registryName ?? "Test Silvana Registry";
  const developerName = config.developerName ?? "TestDev";
  const developerGithub = config.developerGithub ?? "testdev";
  const developerImage = config.developerImage;
  const developerDescription = config.developerDescription ?? "Test developer for automated testing";
  const developerSite = config.developerSite ?? "https://test.dev";
  
  const appName = config.appName ?? "TestApp";
  const appDescription = config.appDescription ?? "Test application for automated testing";
  const appImage = config.appImage;
  const appSite = config.appSite ?? "https://testapp.dev";
  
  const testAgentName = config.testAgentName ?? "TestAgent";
  const testAgentImage = config.testAgentImage;
  const testAgentChains = config.testAgentChains ?? ["sui-testnet", "sui-devnet"];

  // Get key from environment
  const key = process.env.SUI_KEY;
  if (!key) {
    throw new Error("SUI_KEY is not set in environment");
  }
  
  const keyPair = Ed25519Keypair.fromSecretKey(key);
  const address = keyPair.toSuiAddress();
  
  console.log("Creating test registry with sender address:", address);
  console.log("Chain:", process.env.SUI_CHAIN);
  
  // Step 1: Create the registry
  console.log("Step 1: Creating registry...");
  const createRegistryTx = AgentRegistry.createAgentRegistry({
    name: registryName,
  });
  createRegistryTx.setSender(address);
  createRegistryTx.setGasBudget(100_000_000);
  
  const registryResult = await executeTx({
    tx: createRegistryTx,
    keyPair,
  });
  
  if (!registryResult?.tx?.objectChanges) {
    throw new Error("Failed to create registry - no object changes");
  }
  
  // Find the created registry object
  const registryObject = registryResult.tx.objectChanges.find(
    (obj: any) => obj.type === "created" && obj.objectType?.includes("::registry::SilvanaRegistry")
  );
  
  if (!registryObject || !('objectId' in registryObject)) {
    throw new Error("Failed to find created registry object");
  }
  
  const registryAddress = registryObject.objectId;
  console.log("Registry created with address:", registryAddress);
  
  if (registryResult.digest) {
    await waitTx(registryResult.digest);
  }
  
  // Create registry instance for further operations
  const registry = new AgentRegistry({ registry: registryAddress });
  const appInstanceManager = new AppInstanceManager({ registry: registryAddress });
  
  // Step 2: Create developer
  console.log("Step 2: Creating developer...");
  const createDeveloperTx = registry.createDeveloper({
    name: developerName,
    github: developerGithub,
    image: developerImage,
    description: developerDescription,
    site: developerSite,
  });
  createDeveloperTx.setSender(address);
  createDeveloperTx.setGasBudget(100_000_000);
  
  const developerResult = await executeTx({
    tx: createDeveloperTx,
    keyPair,
  });
  
  if (developerResult?.digest) {
    await waitTx(developerResult.digest);
  }
  console.log("Developer created:", developerName);
  
  // Step 3: Create app (using registry::add_app)
  console.log("Step 3: Creating app...");
  const createAppTx = new Transaction();
  createAppTx.moveCall({
    target: `${process.env.SILVANA_REGISTRY_PACKAGE ?? "@silvana/agent"}::registry::add_app`,
    arguments: [
      createAppTx.object(registryAddress),
      createAppTx.pure.string(appName),
      createAppTx.pure.option("string", appDescription),
      createAppTx.object("0x6"), // SUI_CLOCK_OBJECT_ID
    ],
  });
  createAppTx.setSender(address);
  createAppTx.setGasBudget(100_000_000);
  
  const appResult = await executeTx({
    tx: createAppTx,
    keyPair,
  });
  
  if (appResult?.digest) {
    await waitTx(appResult.digest);
  }
  console.log("App created:", appName);
  
  // Step 4: Optionally create agent (if test agent name is provided with chains)
  let agentName: string | undefined;
  if (config.testAgentName && config.testAgentChains) {
    console.log("Step 4: Creating agent...");
    const createAgentTx = registry.createAgent({
      developer: developerName,
      name: testAgentName,
      image: testAgentImage,
      description: "Test agent for automated testing",
      chains: testAgentChains,
    });
    createAgentTx.setSender(address);
    createAgentTx.setGasBudget(100_000_000);
    
    const agentResult = await executeTx({
      tx: createAgentTx,
      keyPair,
    });
    
    if (agentResult?.digest) {
      await waitTx(agentResult.digest);
    }
    agentName = testAgentName;
    console.log("Agent created:", testAgentName);
  }
  
  console.log("Test registry setup complete!");
  console.log("Registry address:", registryAddress);
  console.log("Developer:", developerName);
  console.log("App:", appName);
  if (agentName) {
    console.log("Agent:", agentName);
  }
  
  return {
    registryAddress,
    developerName,
    appName,
    agentName,
    registry,
    appInstanceManager,
    keyPair,
    address,
  };
}

/**
 * Helper to create an app instance in the test registry
 */
export async function createTestAppInstance(
  testRegistry: TestRegistryResult,
  description?: string,
  url?: string
): Promise<string> {
  console.log("Creating test app instance for app:", testRegistry.appName);
  
  const tx = testRegistry.appInstanceManager.createAppInstance({
    registry: testRegistry.registryAddress,
    appName: testRegistry.appName,
    description: description ?? `Test instance for ${testRegistry.appName}`,
    url,
  });
  
  tx.setSender(testRegistry.address);
  tx.setGasBudget(100_000_000);
  
  const result = await executeTx({
    tx,
    keyPair: testRegistry.keyPair,
  });
  
  if (!result || !result.tx) {
    throw new Error("Failed to create app instance - no transaction result");
  }
  
  // Wait for the transaction to be confirmed
  if (result.digest) {
    const confirmedTx = await waitTx(result.digest);
    // Use the confirmed transaction for object changes
    result.tx = confirmedTx;
  }
  
  if (!result?.tx?.objectChanges) {
    throw new Error("Failed to create app instance - no object changes");
  }
  
  // Find the created app instance object (it will be shared)
  const appInstanceObject = result.tx.objectChanges.find(
    (obj: any) => 
      obj.type === "created" && 
      obj.objectType?.includes("::app_instance::AppInstance")
  );
  
  if (!appInstanceObject || !('objectId' in appInstanceObject)) {
    throw new Error("Failed to find created app instance object");
  }
  
  const appInstanceId = appInstanceObject.objectId;
  console.log("App instance created:", appInstanceId);
  
  if (result.digest) {
    await waitTx(result.digest);
  }
  
  return appInstanceId;
}