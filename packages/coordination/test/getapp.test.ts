import { describe, it } from "node:test";
import assert from "node:assert";
import { AgentRegistry } from "../src/agent.js";

let REGISTRY_ADDRESS: string | undefined = process.env.SILVANA_REGISTRY_ADDRESS;

describe("App Registry", async () => {
  it("should get app", async () => {
    if (!REGISTRY_ADDRESS) {
      throw new Error(
        "Registry address not set - SILVANA_REGISTRY_ADDRESS env var required"
      );
    }
    
    const registry = new AgentRegistry({
      registry: REGISTRY_ADDRESS,
    });
    
    const appName = "add_app";
    const app = await registry.getApp({ name: appName });
    
    console.log("App retrieved:", app);
    
    // Check that app exists
    assert(app, "App should be retrieved");
    assert(app.name === appName, "App name should match");
    assert(app.id === "0xcf903a119dcdd4d5dd87e290ba2467fd1c59273249a0e1453ffa1344c011bab6", "App ID should match");
    
    // Check basic fields
    assert(app.description === "Silvana Add App", "App description should match");
    assert(app.owner === "0x3f176926a223d730fea3998da1791f4c7517e73bf3472e233a316d8672275683", "App owner should match");
    assert(app.version === 7, "App version should be 7");
    
    // Check timestamps
    assert(app.createdAt === 1757457417864, "App createdAt should match");
    assert(app.updatedAt === 1757457417864, "App updatedAt should match");
    
    // Check instances array
    assert(Array.isArray(app.instances), "App instances should be an array");
    assert(app.instances.length === 0, "App instances should be empty");
    
    // Check methods exist
    assert(app.methods, "App should have methods");
    assert(typeof app.methods === "object", "App methods should be an object");
    
    const methodNames = Object.keys(app.methods);
    assert(methodNames.length === 5, "App should have 5 methods");
    
    // Check each method has the correct structure
    const expectedMethods = ["init", "add", "multiply", "merge", "settle"];
    for (const methodName of expectedMethods) {
      assert(app.methods[methodName], `Method ${methodName} should exist`);
      const method = app.methods[methodName];
      
      // Each method should have these fields (they can be undefined)
      assert("description" in method, `Method ${methodName} should have description field`);
      assert("developer" in method, `Method ${methodName} should have developer field`);
      assert("agent" in method, `Method ${methodName} should have agent field`);
      assert("agentMethod" in method, `Method ${methodName} should have agentMethod field`);
    }
    
    console.log("App data structure validated successfully");
  });
});