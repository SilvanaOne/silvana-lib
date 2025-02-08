/**
 * Type representing the supported network IDs for the Mina Protocol.
 *
 * Currently supports:
 * - `"testnet"`: The Mina local blockchain and devnet
 * - `"mainnet"`: The Mina mainnet
 */
export type SupportedNetworkId = "testnet" | "mainnet";

/**
 * An object containing the verification keys for the NFT Collection and NFT contracts on different networks.
 *
 *
 * @remarks
 * The `NFTVerificationKeys` object maps a `SupportedNetworkId` to the corresponding verification keys for the NFT Collection and NFT contracts.
 *
 * **Structure:**
 * - `network`: The network identifier (`"testnet"` or `"mainnet"`).
 *   - `collection`:
 *     - `hash`: The hash of the verification key for the NFT Collection contract.
 *     - `data`: The verification key data for the NFT Collection contract.
 *   - `nft`:
 *     - `hash`: The hash of the verification key for the NFT contract.
 *     - `data`: The verification key data for the NFT contract.
 *
 * @example
 * Accessing the verification key hash for the NFT Collection on testnet:
 * ```typescript
 * const testnetCollectionVKHash = NFTVerificationKeys["testnet"].collection.hash;
 * ```
 */
export const nftVerificationKeys: {
  [key in "mainnet" | "testnet"]: {
    o1js: string;
    zkcloudworker: string;
    vk: {
      [key: string]: {
        hash: string;
        data: string;
        type: "nft" | "collection" | "admin" | "upgrade" | "user";
      };
    };
  };
} = {
  mainnet: {
    o1js: "2.1.0",
    zkcloudworker: "0.20.3",
    vk: {
      VerificationKeyUpgradeAuthority: {
        hash: "11985403017286473627966300663722292870964778138598849061271153789533016168559",
        data: "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",
        type: "upgrade",
      },
    },
  },
  testnet: {
    o1js: "2.1.0",
    zkcloudworker: "0.20.3",
    vk: {
      VerificationKeyUpgradeAuthority: {
        hash: "24248690097061452380259183021520676826201948296409686318469332616191300421924",
        data: "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",
        type: "upgrade",
      },
    },
  },
};
