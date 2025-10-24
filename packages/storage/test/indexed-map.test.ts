import { describe, it } from "node:test";
import assert from "node:assert";
import { IndexedMerkleMap } from "o1js";
import {
  serializeIndexedMap,
  deserializeIndexedMerkleMap,
} from "../src/indexed-map/indexed-map.js";
import { randomIndexedMap } from "./helpers/indexed-map.js";

const NUMBER_OF_ITERATIONS = 10;

describe("Test serializing and deserializing IndexedMerkleMap", () => {
  it("should serialize and deserialize IndexedMerkleMap with random data", async () => {
    for (let i = 0; i < NUMBER_OF_ITERATIONS; i++) {
      // Generate a random IndexedMerkleMap with random data
      const originalMap = randomIndexedMap(20, 10, 50);

      // Serialize the map
      const serialized = serializeIndexedMap(originalMap);

      // Verify serialized structure
      assert(serialized.height === 20, "Height should be 20");
      assert(typeof serialized.root === "string", "Root should be a string");
      assert(
        typeof serialized.internalRoot === "string",
        "InternalRoot should be a string"
      );
      assert(
        typeof serialized.length === "string",
        "Length should be a string"
      );
      assert(typeof serialized.nodes === "string", "Nodes should be a string");
      assert(
        typeof serialized.sortedLeaves === "string",
        "SortedLeaves should be a string"
      );

      // Deserialize the map
      const MapClass = IndexedMerkleMap(20);
      const deserializedMap = deserializeIndexedMerkleMap({
        serializedIndexedMap: serialized,
        type: MapClass,
      });

      // Verify deserialization succeeded
      assert(
        deserializedMap !== undefined,
        "Deserialized map should not be undefined"
      );

      // Verify the deserialized map matches the original
      assert(
        deserializedMap!.root.equals(originalMap.root).toBoolean(),
        `Root should match for iteration ${i + 1}`
      );
      assert(
        deserializedMap!.length.equals(originalMap.length).toBoolean(),
        `Length should match for iteration ${i + 1}`
      );
      assert(
        deserializedMap!._internalRoot
          .equals(originalMap._internalRoot)
          .toBoolean(),
        `Internal root should match for iteration ${i + 1}`
      );
      assert.strictEqual(
        deserializedMap!.height,
        originalMap.height,
        `Height should match for iteration ${i + 1}`
      );
    }
  });

  it("should serialize and deserialize empty IndexedMerkleMap", async () => {
    const MapClass = IndexedMerkleMap(20);
    const emptyMap = new MapClass();

    const serialized = serializeIndexedMap(emptyMap);
    const deserializedMap = deserializeIndexedMerkleMap({
      serializedIndexedMap: serialized,
      type: MapClass,
    });

    assert(
      deserializedMap !== undefined,
      "Deserialized empty map should not be undefined"
    );
    assert(
      deserializedMap!.root.equals(emptyMap.root).toBoolean(),
      "Empty map root should match"
    );
    assert(
      deserializedMap!.length.equals(emptyMap.length).toBoolean(),
      "Empty map length should match"
    );
  });
});
