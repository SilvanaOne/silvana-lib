/**
 * NFTMatchProgram is a ZkProgram providing zero-knowledge proofs for matching NFT metadata to Smart Contract state.
 *
 * @module NFTMatchProgram
 */

import { ZkProgram, Field, Cache, PublicKey, SelfProof, Provable } from "o1js";
import { NFTState } from "../interfaces/types.js";
import { Metadata, MetadataMap, MetadataValue } from "../metadata/metadata.js";
import { fieldFromString } from "../interfaces/encoding.js";
import { createIpfsURL, Storage } from "@silvana-one/storage";
export { NFTGameProgram };

/**
 * Defines the NFTProgram ZkProgram with methods for updating NFT metadata.
 */
const NFTGameProgram = ZkProgram({
  name: "NFTGameProgram",
  publicInput: NFTState,
  publicOutput: NFTState,
  methods: {
    /**
     * Updates the NFT's metadata map with a new key-value pairs.
     *
     * @returns {Promise<{ publicOutput: NFTState; auxiliaryOutput: MetadataMap }>} A promise resolving to an object containing the updated NFT state and auxiliary output.
     *
     * @remarks
     * This method verifies that the provided signature is valid and corresponds to the NFT owner.
     * It then inserts the new key-value pair into the metadata map, ensuring that the key does not already exist.
     * The method returns an updated NFT state with the new metadata root and increments the version.
     */
    updateMetadataAndOwner: {
      privateInputs: [MetadataMap, PublicKey, Field, Field, Storage, PublicKey],
      auxiliaryOutput: MetadataMap,
      async method(
        initialState: NFTState,
        metadata: MetadataMap,
        contract: PublicKey,
        score: Field,
        color: Field,
        storage: Storage,
        owner: PublicKey
      ): Promise<{ publicOutput: NFTState; auxiliaryOutput: MetadataMap }> {
        metadata.root.assertEquals(initialState.metadata);
        metadata.set(
          fieldFromString("color"),
          MetadataValue.new({ value: color, type: "field" }).hash()
        );
        metadata.set(
          fieldFromString("score"),
          MetadataValue.new({ value: score, type: "field" }).hash()
        );
        initialState.oracleAddress.assertEquals(contract);
        initialState.context.custom[0].assertEquals(score);
        initialState.context.custom[1].assertEquals(color);
        MetadataValue.new({ value: contract.x, type: "field" })
          .hash()
          .assertEquals(metadata.get(fieldFromString("contractX")));
        MetadataValue.new({
          value: contract.isOdd.toField(),
          type: "field",
        })
          .hash()
          .assertEquals(metadata.get(fieldFromString("contractIsOdd")));

        contract.assertEquals(initialState.oracleAddress);

        // This code does NOT create a constraint on the storage as we use IPFS.
        // It is used to verify that the storage that will be used is valid.
        // After Project Untitled will be released, this code should be changed
        // to create a constraint on the storage using Project Untitled.
        const metadataRoot = await Provable.witnessAsync(Field, async () => {
          const fetchResult = await fetch(
            createIpfsURL({ hash: storage.toString() })
          );
          if (!fetchResult.ok) {
            throw new Error("Failed to fetch metadata");
          }
          const json = await fetchResult.json();
          if (!json) {
            throw new Error("Failed to fetch metadata");
          }

          const metadata = Metadata.fromJSON({
            json,
            checkRoot: true,
          });
          return metadata.map.root;
        });
        metadataRoot.assertEquals(metadata.root);

        // Owner can be updated only in case of a maximum score - 7 when the winner gets the NFT
        owner
          .equals(initialState.owner)
          .or(score.equals(Field(7)))
          .assertTrue();

        return {
          publicOutput: new NFTState({
            metadata: metadata.root,
            owner,
            storage,
            immutableState: initialState.immutableState,
            approved: initialState.approved,
            name: initialState.name,
            isPaused: initialState.isPaused,
            version: initialState.version.add(1),
            metadataVerificationKeyHash:
              initialState.metadataVerificationKeyHash,
            creator: initialState.creator,
            oracleAddress: initialState.oracleAddress,
            context: initialState.context,
          }),
          auxiliaryOutput: metadata,
        };
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],
      async method(
        initialState: NFTState,
        proof1: SelfProof<NFTState, NFTState>,
        proof2: SelfProof<NFTState, NFTState>
      ) {
        proof1.verify();
        proof2.verify();
        NFTState.assertEqual(initialState, proof1.publicInput);
        NFTState.assertEqual(proof1.publicOutput, proof2.publicInput);
        return {
          publicOutput: proof2.publicOutput,
        };
      },
    },
  },
});
