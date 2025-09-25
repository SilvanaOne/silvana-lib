import { Field, IndexedMerkleMap } from "o1js";
import { bigintToBase64, bigintFromBase64 } from "../base64/bigint.js";
import { sleep } from "../util/sleep.js";
import { pinJSON } from "../storage/pinata.js";

export interface IndexedMapSerialized {
  height: number;
  root: string;
  length: string;
  nodes: string;
  sortedLeaves: string;
}

export type IndexedMapSerializedJson = {
  [key: string]: { map: IndexedMapSerialized };
};

export async function loadIndexedMerkleMap(params: {
  url: string;
  type: ReturnType<typeof IndexedMerkleMap>;
  name?: string;
  timeout?: number;
  attempts?: number;
}) {
  const {
    url,
    type,
    name = "indexed-map",
    timeout = 60000,
    attempts = 5,
  } = params;
  let attempt = 0;
  const start = Date.now();
  let response = await fetch(url);
  while (!response.ok && attempt < attempts && Date.now() - start < timeout) {
    attempt++;
    await sleep(5000 * attempt); // handle rate limiting
    response = await fetch(url);
  }
  if (!response.ok) {
    throw new Error("Failed to fetch IndexedMerkleMap");
  }

  const json = await response.json();
  const serializedIndexedMap = (json as unknown as IndexedMapSerializedJson)[
    name
  ].map;
  if (!serializedIndexedMap)
    throw new Error("wrong IndexedMerkleMap json format");
  const map = deserializeIndexedMerkleMapInternal({
    serializedIndexedMap,
    type,
  });
  if (!map) {
    throw new Error("Failed to deserialize whitelist");
  }
  return map;
}

export async function saveIndexedMerkleMap(params: {
  map: IndexedMerkleMap;
  name?: string;
  filename?: string;
  keyvalues?: { key: string; value: string }[];
  auth: string;
}): Promise<string | undefined> {
  const {
    map,
    name = "indexed-map",
    keyvalues,
    auth,
    filename = "indexed-map",
  } = params;
  const serialized = serializeIndexedMap(map);
  const json: IndexedMapSerializedJson = { [name]: { map: serialized } };
  const ipfsHash = await pinJSON({
    data: json,
    name: filename,
    keyvalues,
    auth,
  });
  return ipfsHash;
}

export function serializeIndexedMap(
  map: IndexedMerkleMap
): IndexedMapSerialized {
  return {
    height: map.height,
    root: map.root.toJSON(),
    length: map.length.toJSON(),
    nodes: JSON.stringify(map.data.get().nodes, (_, v) =>
      typeof v === "bigint" ? "n" + bigintToBase64(v) : v
    ),
    sortedLeaves: JSON.stringify(
      map.data
        .get()
        .sortedLeaves.map((v) => [
          bigintToBase64(v.key),
          bigintToBase64(v.nextKey),
          bigintToBase64(v.value),
          bigintToBase64(BigInt(v.index)),
        ])
    ),
  };
}

export function deserializeIndexedMerkleMap(params: {
  serializedIndexedMap: IndexedMapSerialized;
  type?: ReturnType<typeof IndexedMerkleMap>;
}): InstanceType<ReturnType<typeof IndexedMerkleMap>> | undefined {
  try {
    const { serializedIndexedMap, type } = params;
    return deserializeIndexedMerkleMapInternal({
      serializedIndexedMap,
      type: type ?? IndexedMerkleMap(serializedIndexedMap.height),
    });
  } catch (error: any) {
    console.error("Error deserializing map:", error?.message ?? error);
    return undefined;
  }
}

export function parseIndexedMapSerialized(
  serializedMap: string
): IndexedMapSerialized {
  const json = JSON.parse(serializedMap);
  if (
    json.height === undefined ||
    json.root === undefined ||
    json.length === undefined ||
    json.nodes === undefined ||
    json.sortedLeaves === undefined
  )
    throw new Error("wrong IndexedMerkleMap json format");
  if (typeof json.height !== "number")
    throw new Error("wrong IndexedMerkleMap height format");
  if (typeof json.root !== "string")
    throw new Error("wrong IndexedMerkleMap root format");
  if (typeof json.length !== "string")
    throw new Error("wrong IndexedMerkleMap length format");
  if (typeof json.nodes !== "string")
    throw new Error("wrong IndexedMerkleMap nodes format");
  if (typeof json.sortedLeaves !== "string")
    throw new Error("wrong IndexedMerkleMap sortedLeaves format");
  return json;
}

function deserializeIndexedMerkleMapInternal(params: {
  serializedIndexedMap: IndexedMapSerialized;
  type: ReturnType<typeof IndexedMerkleMap>;
}): InstanceType<ReturnType<typeof IndexedMerkleMap>> {
  const { serializedIndexedMap, type } = params;
  const map = new type();
  if (serializedIndexedMap.height !== map.height) {
    throw new Error("wrong IndexedMap height");
  }
  const nodes = JSON.parse(serializedIndexedMap.nodes, (_, v) => {
    // Check if the value is a string that represents a BigInt
    if (typeof v === "string" && v[0] === "n") {
      // Remove the first 'n' and convert the string to a BigInt
      return bigintFromBase64(v.slice(1));
    }
    return v;
  });
  const sortedLeaves = JSON.parse(serializedIndexedMap.sortedLeaves).map(
    (row: any) => {
      return {
        key: bigintFromBase64(row[0]),
        nextKey: bigintFromBase64(row[1]),
        value: bigintFromBase64(row[2]),
        index: Number(bigintFromBase64(row[3])),
      };
    }
  );

  (map as any).root = Field.fromJSON(serializedIndexedMap.root);
  map.length = Field.fromJSON(serializedIndexedMap.length);
  map.data.updateAsProver(() => {
    return {
      nodes: nodes.map((row: any) => [...row]),
      sortedLeaves: [...sortedLeaves],
    };
  });
  return map;
}
