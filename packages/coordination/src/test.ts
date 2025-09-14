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

export interface TestAppResult {
  testAppAddress: string;
  appInstanceAddress: string;
  appInstanceCapAddress: string;
  registryAddress: string;
  appName: string;
  keyPair: Ed25519Keypair;
  address: string;
  appInstanceManager: AppInstanceManager;
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
  
  if (!registryResult) {
    throw new Error("Failed to create registry - no result");
  }
  
  if (registryResult.error) {
    throw new Error(`Failed to create registry: ${registryResult.error}`);
  }
  
  if (!registryResult.tx?.objectChanges) {
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
    developerOwner: address,
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
  
  if (!developerResult) {
    throw new Error("Failed to create developer - no result");
  }
  
  if (developerResult.error) {
    throw new Error(`Failed to create developer: ${developerResult.error}`);
  }
  
  if (developerResult.digest) {
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
      createAppTx.pure.address(address),
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
  
  if (!appResult) {
    throw new Error("Failed to create app - no result");
  }
  
  if (appResult.error) {
    throw new Error(`Failed to create app: ${appResult.error}`);
  }
  
  if (appResult.digest) {
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
    
    if (!agentResult) {
      throw new Error("Failed to create agent - no result");
    }
    
    if (agentResult.error) {
      throw new Error(`Failed to create agent: ${agentResult.error}`);
    }
    
    if (agentResult.digest) {
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
 * Creates a TestApp with an initialized AppInstance using the new TestApp module
 * This uses the create_test_app function from the Move contract
 */
export async function createTestApp(
  registryAddress: string,
  appName: string = "test_app"
): Promise<TestAppResult> {
  // Get key from environment
  const key = process.env.SUI_KEY;
  if (!key) {
    throw new Error("SUI_KEY is not set in environment");
  }
  
  const keyPair = Ed25519Keypair.fromSecretKey(key);
  const address = keyPair.toSuiAddress();
  
  console.log("Creating TestApp with AppInstance...");
  console.log("Registry address:", registryAddress);
  console.log("Sender address:", address);
  
  // First, check if the app already exists by trying to create it
  // If it fails with "already exists" error, that's fine - we can continue
  const createAppTx = new Transaction();
  createAppTx.moveCall({
    target: `${process.env.SILVANA_REGISTRY_PACKAGE ?? "@silvana/agent"}::registry::add_app`,
    arguments: [
      createAppTx.object(registryAddress),
      createAppTx.pure.string(appName),
      createAppTx.pure.address(address),
      createAppTx.pure.option("string", "Test app for TestApp module"),
      createAppTx.object("0x6"), // SUI_CLOCK_OBJECT_ID
    ],
  });
  createAppTx.setSender(address);
  createAppTx.setGasBudget(100_000_000);
  
  const appResult = await executeTx({
    tx: createAppTx,
    keyPair,
    showErrors: false,  // Don't throw, we'll handle the error
  });
  
  if (appResult?.digest && !appResult.error) {
    await waitTx(appResult.digest);
    console.log("App created:", appName);
  } else if (appResult?.error?.includes("0) in command 0")) {
    // Error code 0 from dynamic_field::add means the field already exists
    console.log("App already exists, continuing:", appName);
  } else if (appResult?.error) {
    throw new Error(`Failed to create app for TestApp: ${appResult.error}`);
  }
  
  // Call create_test_app to create a TestApp with an AppInstance
  const tx = new Transaction();
  tx.moveCall({
    target: `${process.env.SILVANA_REGISTRY_PACKAGE ?? "@silvana/agent"}::test_app::create_test_app`,
    arguments: [
      tx.object(registryAddress),
      tx.object("0x6"), // SUI_CLOCK_OBJECT_ID
    ],
  });
  
  tx.setSender(address);
  tx.setGasBudget(100_000_000);
  
  const result = await executeTx({
    tx,
    keyPair,
  });
  
  if (!result) {
    throw new Error("Failed to create TestApp - no result");
  }
  
  if (result.error) {
    throw new Error(`Failed to create TestApp: ${result.error}`);
  }
  
  if (!result.tx) {
    throw new Error("Failed to create TestApp - no transaction result");
  }
  
  // Wait for the transaction to be confirmed
  if (result.digest) {
    const confirmedTx = await waitTx(result.digest);
    result.tx = confirmedTx;
  }
  
  if (!result?.tx?.objectChanges) {
    throw new Error("Failed to create TestApp - no object changes");
  }
  
  // Find the created TestApp object (it will be shared)
  const testAppObject = result.tx.objectChanges.find(
    (obj: any) => 
      obj.type === "created" && 
      obj.objectType?.includes("::test_app::TestApp")
  );
  
  if (!testAppObject || !('objectId' in testAppObject)) {
    throw new Error("Failed to find created TestApp object");
  }
  
  // Find the created AppInstance object (it will be shared)
  const appInstanceObject = result.tx.objectChanges.find(
    (obj: any) => 
      obj.type === "created" && 
      obj.objectType?.includes("::app_instance::AppInstance")
  );
  
  if (!appInstanceObject || !('objectId' in appInstanceObject)) {
    throw new Error("Failed to find created AppInstance object");
  }
  
  const testAppAddress = testAppObject.objectId;
  const appInstanceAddress = appInstanceObject.objectId;
  
  // AppInstanceCap is stored inside the TestApp, not as a separate shared object
  // We'll use the TestApp address as a placeholder since the cap is embedded
  const appInstanceCapAddress = testAppAddress;
  
  console.log("TestApp created:", testAppAddress);
  console.log("AppInstance created:", appInstanceAddress);
  console.log("AppInstanceCap created:", appInstanceCapAddress);
  
  const appInstanceManager = new AppInstanceManager({ registry: registryAddress });
  
  return {
    testAppAddress,
    appInstanceAddress,
    appInstanceCapAddress,
    registryAddress,
    appName,
    keyPair,
    address,
    appInstanceManager,
  };
}

// Note: createTestAppInstance has been removed. Use createTestApp instead, which creates
// a TestApp with an embedded AppInstance using the Move test_app module.