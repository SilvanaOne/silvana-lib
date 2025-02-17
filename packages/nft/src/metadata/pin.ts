import { Metadata } from "./metadata.js";
import {
  pinJSON,
  serializeIndexedMap,
  IndexedMapSerialized,
} from "@silvana-one/storage";
import { Field } from "o1js";

export async function pinMetadata(metadata: Metadata): Promise<{
  name: string;
  ipfsHash: string;
  metadataRoot: Field;
  privateMetadata: string;
  serializedMap: IndexedMapSerialized;
}> {
  const privateMetadata = JSON.stringify(metadata.toJSON(true), null, 2);
  const ipfsHash: string | undefined = await pinJSON({
    data: metadata.toJSON(false),
    name: "nft-metadata",
  });
  if (!ipfsHash) throw new Error("Failed to pin metadata");

  return {
    name: metadata.name,
    ipfsHash,
    metadataRoot: metadata.map.root,
    privateMetadata,
    serializedMap: serializeIndexedMap(metadata.map),
  };
}
