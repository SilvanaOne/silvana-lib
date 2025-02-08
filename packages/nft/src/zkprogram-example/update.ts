/**
 * NFTProgram is a ZkProgram providing zero-knowledge proofs for updating NFT metadata.
 * It includes methods for inserting metadata entries and merging proofs.
 *
 * @module NFTProgram
 */

import { ZkProgram, Field, Cache, SelfProof, Signature } from "o1js";
import { NFTState } from "../interfaces/types.js";
import { MetadataMap } from "../metadata/metadata.js";
export { NFTProgram };

/**
 * Defines the NFTProgram ZkProgram with methods for updating NFT metadata.
 */
const NFTProgram = ZkProgram({
  name: "NFTProgram",
  publicInput: NFTState,
  publicOutput: NFTState,
  methods: {
    /**
     * Inserts a metadata key-value pair into the NFT's metadata map.
     *
     * @returns {Promise<{ publicOutput: NFTState; auxiliaryOutput: MetadataMap }>} A promise resolving to an object containing the updated NFT state and auxiliary output.
     *
     * @remarks
     * This method verifies that the provided signature is valid and corresponds to the NFT owner.
     * It then inserts the new key-value pair into the metadata map, ensuring that the key does not already exist.
     * The method returns an updated NFT state with the new metadata root and increments the version.
     */
    insertMetadata: {
      privateInputs: [MetadataMap, Field, Field, Signature],
      auxiliaryOutput: MetadataMap,
      async method(
        initialState: NFTState,
        metadata: MetadataMap,
        key: Field,
        value: Field,
        signature: Signature
      ): Promise<{ publicOutput: NFTState; auxiliaryOutput: MetadataMap }> {
        signature
          .verify(initialState.owner, [
            ...NFTState.toFields(initialState),
            key,
            value,
          ])
          .assertTrue("Wrong owner signature");
        metadata.insert(key, value); // Proves that key does not exist

        return {
          publicOutput: new NFTState({
            immutableState: initialState.immutableState,
            metadata: metadata.root,
            owner: initialState.owner,
            approved: initialState.approved,
            name: initialState.name,
            storage: initialState.storage,
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
    /**
     * Merges two self-proofs to produce a new NFT state.
     *
     * @returns {Promise<{ publicOutput: NFTState }>} A promise resolving to an object containing the merged NFT state.
     *
     * @remarks
     * This method verifies both proofs and asserts the consistency of their inputs and outputs.
     * It ensures that the initial state matches the public input of the first proof,
     * and that the public output of the first proof matches the public input of the second proof.
     * The method returns the public output of the second proof as the new merged NFT state.
     */
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
