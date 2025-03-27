# NFT Metadata

## Metadata: Detailed Guide for NFT Creators

This section provides a comprehensive overview of how metadata is structured in this NFT system and how you can use it within your contracts and off-chain tools. We will reference the code from `@metadata.ts`, `@address.ts`, `@text.ts`, `@tree.ts`, `@pin.ts`, and `@metadata.test.ts` to illustrate how it all fits together. We will also show how these structures integrate with the NFT and Collection contracts (`@nft.ts` and `@collection.ts`).

### Overview of the Metadata Flow

1. **Creation of Metadata**

   - You instantiate a `Metadata` object with core fields like `name`, `image`, `description`, etc.
   - Additional traits (key-value pairs) can be added to the `Metadata` object using `addTrait()`.
   - Sensitive or hidden traits can be marked as private, ensuring they don't appear in the public JSON representation.

2. **Merkle Tree Structures**

   - For text fields, a specialized `Text` Merkle tree allows large strings to be hashed securely.
   - For an entire set of key-value pairs, a `MetadataMap` (and optionally a `MetadataTree`) ensures proof-of-inclusion can be performed without revealing the entirety of the data.

3. **Pinning and Storing**

   - Once your `Metadata` object is ready, you can store it off-chain (for example, on IPFS) using the helper function `pinMetadata()` in `@pin.ts`.
   - The `pinMetadata()` function returns an `ipfsHash` and the `metadataRoot`. This root is crucial for verifying the integrity of the metadata inside your NFT contract.

### Core Classes and Their Roles

1. **`Metadata`** (from `metadata.ts`)

   - Represents the primary container for your NFT’s data.
   - Stores universal fields like `name`, `image`, `description`, plus a flexible `plugins` array.
   - Uses `MetadataMap` under the hood, which is an `IndexedMerkleMap` for storing traits in a Merkle tree.
   - You can serialize it into JSON (with or without private traits) and also rebuild the structure using `Metadata.fromJSON()` or `Metadata.fromOpenApiJSON()`.

2. **`Text`** (from `text.ts`)

   - Encodes a string into a Merkle tree at creation, ensuring large strings can be hashed in a tamper-evident way.
   - When you add a trait of type `"text"`, you can store the entire text as a `Text` tree.

3. **`MinaAddress`** (from `address.ts`)

   - Similar idea for addresses: it turns a `PublicKey` into a hashed `Field`.
   - Useful if you want to store addresses or partial addresses in your metadata.

4. **`MetadataTree`** (from `tree.ts`)

   - An optional specialized data structure for storing sets of `(key, value)` pairs in a Merkle tree.
   - If you have very large or complex data, you can create a subtree of metadata, reference only its root, and prove the existence of particular entries as needed.

### Key Steps to Implement Metadata in Your NFT Project

1. **Create a `Metadata` Object**

   ```ts
   const customMetadata = new Metadata({
     name: "MyAwesomeNFT",
     image: "https://example.com/awesome.png",
     description: "A truly awesome NFT",
     plugins: [], // optionally, you could include something like [new ColorPlugin()]
   });
   ```

2. **Add Traits**

   ```ts
   customMetadata.addTrait({
     key: "artist",
     type: "string",
     value: "Alice",
   });
   customMetadata.addTrait({
     key: "color",
     type: "color", // loaded via plugin (e.g., ColorPlugin)
     value: "red",
   });
   customMetadata.addTrait({
     key: "secretNote",
     type: "text",
     value: "A hidden surprise for the NFT owner",
     isPrivate: true,
   });
   ```

3. **Pin It (Optional)**

   ```ts
   const { ipfsHash, metadataRoot } = await pinMetadata(customMetadata);
   console.log("Pinned at:", ipfsHash);
   console.log("Root is:", metadataRoot);
   ```

4. **Reference the Metadata in Your Contract**

   - When minting the NFT, add `metadataRoot` and `ipfsHash` to metadata and storage fields of `MintParams`.
   - Ensure your contract logic checks the relevant flags (e.g., `canChangeMetadata`) before letting the `metadata` be changed.

5. **Verifying Off-Chain**
   - Any user or dApp can retrieve your NFT’s metadata from IPFS and compare the `metadataRoot` in the on-chain state with the root from the pinned file.
   - If they match, the user knows the data is authentic and unaltered. It is possible when all the data is public. If you have a private data, then you need to prepare a proof for specific trait.

### 5. Testing and Examples

- Take a look at `metadata.test.ts` for real usage examples. It shows how you can create random metadata, serialize to JSON, and then deserialize it back to a `Metadata` object for verification.
- The test also demonstrates how to handle private vs. public traits. The JSON produced by `toJSON(false)` omits private trait data, while `toJSON(true)` includes everything.

### 6. Best Practices

1. **Use Private Traits Sparingly**

   - Mark fields as private only if you genuinely need to hide them from the public JSON.
   - Any data you place in the contract state might still be discoverable if you store it fully on-chain.

2. **Pin or Otherwise Persist Metadata**

   - Relying on ephemeral storage can break your NFT’s data integrity over time.
   - IPFS or decentralized networks are common choices, but always ensure the pinned data is widely hosted.

3. **Validate Before Changing**

   - If your NFT’s contract logic allows metadata updates, ensure an owner or admin signature is required, or that a proof is provided, especially if `canChangeMetadata` is a condition.

4. **Plan for Upgrades**
   - If you foresee changing the proof system for your metadata, keep `canChangeMetadataVerificationKeyHash = true`.
   - This ensures you can adopt new ZK proof mechanisms for verifying your NFT data.

With these steps, you can confidently integrate the metadata classes (`Metadata`, `Text`, `MinaAddress`, `MetadataTree`, etc.) into your own NFT or Collection contract, ensuring your NFT data is secure, verifiable, and customizable.

## Metadata Examples

### Example 1

```json
{
  "name": "Arlette",
  "description": "Arlette is a vivid embodiment of cultural fusion, capturing the essence of global artistry in radiant colors and fluid shapes. Seamlessly blending modern design with traditional motifs, this NFT portrays resilience, creativity, and boundless imagination. Each detail of Arlette’s composition tells a story of unity and hope, inviting observers to journey through a world where art transcends borders.",
  "image": "https://picsum.photos/seed/6222197/540/670",
  "metadataRoot": "8089567988850885440162712273330394926387804623534417398971006566162209699819",
  "traits": [
    {
      "key": "name",
      "type": "string",
      "value": "Arlette"
    },
    {
      "key": "image",
      "type": "image",
      "value": "https://picsum.photos/seed/8255952/540/670"
    },
    {
      "key": "description",
      "type": "text",
      "value": "Arlette is a vivid embodiment of cultural fusion, capturing the essence of global artistry in radiant colors and fluid shapes. Seamlessly blending modern design with traditional motifs, this NFT portrays resilience, creativity, and boundless imagination. Each detail of Arlette’s composition tells a story of unity and hope, inviting observers to journey through a world where art transcends borders."
    },
    {
      "key": "data",
      "type": "field",
      "value": "6554118177673577367935032062634210489286477101599894267034075633452018550482"
    },
    {
      "key": "Willi",
      "type": "url",
      "value": "https://example.com/Zaria"
    }
  ]
}
```

### Example 2

```json
{
  "name": "Prissie",
  "image": "https://picsum.photos/seed/7871885/540/670",
  "metadataRoot": "23522541297594634759038873120165711491386314828070311826395608643850011570839",
  "traits": [
    {
      "key": "name",
      "type": "string",
      "value": "Prissie"
    },
    {
      "key": "image",
      "type": "image",
      "value": "https://picsum.photos/seed/7871885/540/670"
    },
    {
      "key": "Flossie",
      "type": "text",
      "isPrivate": true,
      "value": "Flossie is a vivid portrayal of boundless creativity, intertwining contemporary vibrancy with timeless motifs. She radiates captivating cultural harmonies, uniting diverse influences into one mesmerizing tapestry of color and modern design. Flossie represents resilience, inspiration, and an unbridled sense of wonder."
    },
    {
      "key": "Maggi",
      "type": "text",
      "isPrivate": true,
      "value": "Maggi is an enchanting NFT that captures the essence of global diversity through vibrant colors and intricate patterns. This piece represents a harmonious blend of cultural elements from around the world, showcasing the beauty of unity in diversity. The delicate balance of warm and cool tones creates a mesmerizing visual experience that invites viewers to explore its depths. Maggi embodies resilience, creativity, and the transformative power of art across boundaries."
    },
    {
      "key": "Annice",
      "type": "image",
      "isPrivate": true,
      "value": "https://picsum.photos/seed/9634474/540/670"
    }
  ]
}
```

```

```
