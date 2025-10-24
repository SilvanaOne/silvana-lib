import { Field, IndexedMerkleMap } from "o1js";

export { randomIndexedMap };

/**
 * Generates a random IndexedMerkleMap with random key-value pairs.
 * @param height - The height of the IndexedMerkleMap (default: 20)
 * @param minEntries - Minimum number of entries to add (default: 10)
 * @param maxEntries - Maximum number of entries to add (default: 50)
 * @returns A new IndexedMerkleMap with random data
 */
function randomIndexedMap(
  height: number = 20,
  minEntries: number = 10,
  maxEntries: number = 50
): InstanceType<ReturnType<typeof IndexedMerkleMap>> {
  const MapClass = IndexedMerkleMap(height);
  const map = new MapClass();

  const numberOfEntries =
    Math.floor(Math.random() * (maxEntries - minEntries + 1)) + minEntries;

  // Generate random key-value pairs and add them to the map
  for (let i = 0; i < numberOfEntries; i++) {
    const key = Field.random();
    const value = Field.random();
    map.set(key, value);
  }

  return map;
}
