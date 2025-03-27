# NFT configuration

## NFT flags

```typescript
/**
 * Represents the data associated with an NFT, including state and permission flags.
 */
class NFTData extends Struct({
  /** The owner of the NFT. */
  owner: PublicKey,
  /** The approved address of the NFT. */
  approved: PublicKey,
  /** The version number of the NFT state. */
  version: UInt64,
  /** The unique identifier of the NFT within the collection. */
  id: UInt64,
  /** Determines whether the NFT's ownership can be changed via a zero-knowledge proof (readonly). */
  canChangeOwnerByProof: Bool, // readonly
  /** Specifies if the NFT's ownership can be transferred (readonly). */
  canTransfer: Bool, // readonly
  /** Specifies if the NFT's approved address can be changed (readonly). */
  canApprove: Bool, // readonly
  /** Indicates whether the NFT's metadata can be updated (readonly). */
  canChangeMetadata: Bool, // readonly
  /** Determines whether the storage associated with the NFT can be altered (readonly). */
  canChangeStorage: Bool, // readonly
  /** Specifies if the name of the NFT can be changed (readonly). */
  canChangeName: Bool, // readonly
  /** Indicates whether the verification key hash for the metadata can be changed (readonly). */
  canChangeMetadataVerificationKeyHash: Bool, // readonly
  /** Specifies if the NFT contract can be paused, preventing certain operations (readonly). */
  canPause: Bool, // readonly
  /** Indicates whether the NFT contract is currently paused. */
  isPaused: Bool,
  /** Determines whether the owner's authorization is required to upgrade the NFT's verification key (readonly). */
  requireOwnerAuthorizationToUpgrade: Bool, // readonly
})
```

## Collection flags

```typescript
/**
 * Represents the data associated with an NFT collection, including configuration parameters and permission flags.
 */
class CollectionData extends Struct({
  /** The royalty fee percentage (e.g., 1000 = 1%, 100 = 0.1%, 10000 = 10%, 100000 = 100%). */
  royaltyFee: UInt32, // 1000 = 1%, 100 = 0.1%, 10000 = 10%, 100000 = 100%
  /** The transfer fee amount. */
  transferFee: UInt64,
  /** If true, transferring NFTs requires approval from the admin contract. */
  requireTransferApproval: Bool,
  /** If true, the minting is stopped and cannot be resumed. */
  mintingIsLimited: Bool,
  /** Indicates whether the collection is currently paused. */
  isPaused: Bool,
  /** The public key part (isOdd) of the pending creator. The x field is written to the contract state as pendingCreatorX */
  pendingCreatorIsOdd: Bool,
})
```

## Best Practices for Using NFT and Collection Flags

Below is a more detailed guide for a collection creator on each flag, how they can interact, and examples of practical usage. You can tailor these flags when creating or managing NFTs and their collections to achieve the desired behaviors.

### NFTData Flags

1. **canChangeOwnerByProof (Bool)**

   - **Meaning**: Allows you (or an external actor) to submit a proof to transfer ownership without the current owner’s signature.
   - **Interaction**:
     - If `canTransfer` is also `true`, it means you can transfer the NFT either by traditional signature or by proof.
     - If `canTransfer` is `false` but `canChangeOwnerByProof` is `true`, then ownership can only be changed via a ZK proof, not a direct signature-based transfer.
   - **Example**: An NFT that can only be traded on specialized marketplaces that generate zero-knowledge transfer proofs or be transferred to the game winner that is able to present the proof of winning the game.

2. **canTransfer (Bool)**

   - **Meaning**: Enables standard transfers of NFT ownership using the owner’s signature.
   - **Interaction**:
     - If `canChangeOwnerByProof` is `false` and `canTransfer` is `true`, then only “regular” transfers using the owner’s signature are allowed.
     - If both flags are `false`, then the NFT is essentially non-transferable (soul-bound).
   - **Example**: If you want a straightforward marketplace (like “normal” NFT transfers), set `canTransfer = true`.

3. **canApprove (Bool)**

   - **Meaning**: Allows the NFT owner to set another address (an “approved” address) that can manage or transfer the NFT on their behalf.
   - **Interaction**:
     - If `canApprove = false`, the NFT can only be managed by the direct owner.
     - If `canTransfer` is `true`, the approved address can typically transfer the NFT as well.
   - **Example**: You might set `canApprove = true` if you want wallets or escrow contracts to manage the NFT for short-term loans or rentals or put it on auction.

4. **canChangeMetadata (Bool)**

   - **Meaning**: Permits updating the NFT’s metadata (such as description, image link, etc.).
   - **Interaction**:
     - If this is `false`, the NFT’s metadata is “frozen” at mint time.
     - You can combine dynamic metadata (like IPFS “folder updates”) with a flexible or “changeable” setting.
   - **Example**: A game NFT whose character stats can be updated over time might require `canChangeMetadata = true`. A collectible NFT that should remain static sets this to `false`.

5. **canChangeStorage (Bool)**

   - **Meaning**: Lets you change the off-chain storage reference or IPFS link for the NFT after it’s minted.
   - **Interaction**:
     - If this is `true`, you can effectively “move” the NFT’s off-chain data from one storage endpoint to another.
     - Often paired with `canChangeMetadata`, so you can fully update references.
   - **Example**: If you store your NFT media on an external server and plan to migrate to IPFS later, keep this `true`.

6. **canChangeName (Bool)**

   - **Meaning**: Authorizes changing the NFT’s name (the `name` field in the contract state).
   - **Interaction**:
     - If `false`, the name set at deployment (or mint) will remain forever.
     - Combined with `canChangeMetadata = false`, the NFT’s brand identity stays completely fixed.
   - **Example**: NFT series that want to let owners rename or “brand” them can keep this `true`. Otherwise, set it `false` for a static name.

7. **canChangeMetadataVerificationKeyHash (Bool)**

   - **Meaning**: Allows updating the `metadataVerificationKeyHash` that controls which ZK proofs can validate metadata changes.
   - **Interaction**:
     - If `canChangeMetadata = true` but this is `false`, you can still change the metadata, but you cannot replace the underlying proof scheme or verification key used to validate it.
   - **Example**: If you anticipate upgrading your proof system for off-chain metadata in the future, set this to `true`.

8. **canPause (Bool)**

   - **Meaning**: Lets you pause the NFT, stopping most updates and transfers.
   - **Interaction**:
     - Only meaningful if your contract logic specifically checks `isPaused` to block actions.
     - Typically used for safety, disputes, or maintenance.
   - **Example**: If you suspect fraudulent activity, you can call the `pause` method (given this is `true`) to halt NFT transfers.

9. **isPaused (Bool)**

   - **Meaning**: Denotes the current pause status of the NFT.
   - **Interaction**:
     - Changes from `false` to `true` by calling a contract method, which checks if `canPause` is `true`.
     - When set to `true`, transfers/approvals (and possibly updates) are blocked, depending on your code logic.
   - **Example**: If your NFT is forcibly paused due to a dispute, `isPaused` changes to `true`, and no one can transfer it until resumed.

10. **requireOwnerAuthorizationToUpgrade (Bool)**
    - **Meaning**: If `true`, any upgrade to the NFT’s own verification key (i.e., the contract logic) requires the owner’s explicit signature or proof.
    - **Interaction**:
      - If `false`, an admin or creator can upgrade the NFT’s verification key unilaterally.
    - **Example**: For maximum security, set this to `true` so that the NFT’s owner must always endorse upgrades.

---

### CollectionData Flags

1. **royaltyFee (UInt32)**

   - **Meaning**: Collects a percentage of the sale price on each NFT transfer. Example rates:
     - `1000` means 1%
     - `100` means 0.1%
     - `10000` means 10%
   - **Interaction**:
     - Often used to reward the original artist/creator on second-hand markets.
     - If `requireTransferApproval` is `true`, the contract logic can check or enforce royalty payment.
   - **Example**: Your collection might impose a 2% royalty with `royaltyFee = 2000`.

2. **transferFee (UInt64)**

   - **Meaning**: A minimum fixed fee (e.g., in MINA) charged on each NFT transfer, regardless of price.
   - **Interaction**:
     - Combined with `royaltyFee`, you can enforce a percentage-based fee that is calculated using `royaltyFee`. In case royalty fee is lower than transfer fee for a given price, the transfer fee will be charged, otherwise, royalty fee will be charged.
     - If `0`, you only rely on `royaltyFee` for revenue.
   - **Example**: Some creators set a small, constant transfer fee (like 0.01 MINA) to cover contract execution costs or for extra revenue.

3. **requireTransferApproval (Bool)**

   - **Meaning**: If `true`, every transfer must be approved by an admin contract or proof.
   - **Interaction**:
     - Works well with escrow logic or complicated compliance checks.
     - If `false`, direct transfers (signature-based) are allowed as long as the NFT itself (`canTransfer = true`) is not paused.
   - **Example**: If your collection requires KYC or specialized marketplace checks, set this to `true` so that every transfer is validated by your admin contract.

4. **mintingIsLimited (Bool)**

   - **Meaning**: When `true`, no new NFTs can be minted in the collection. This is usually permanent once turned on.
   - **Interaction**:
     - If your contract sets this `true`, subsequent calls to mint new NFTs should fail or revert.
     - This does not affect already-existing NFTs.
   - **Example**: After minting your initial 100 NFT run, invoke a method to set `mintingIsLimited = true`, ensuring no more NFT can be minted.

5. **isPaused (Bool)**

   - **Meaning**: Pauses the entire collection. If `true`, actions like transfers or minting typically cannot occur.
   - **Interaction**:
     - Typically toggled by an admin or the collection creator, if the contract logic permits.
     - Combining with `mintingIsLimited` offers strong control over your collection’s lifecycle.
   - **Example**: If you suspect a contract exploit or want to halt trading during an update, set this to `true`.

---

### How the Flags Interact and More Examples

**NFT with Dual Transfer Modes**

- If `canTransfer = true` and `canChangeOwnerByProof = true`, you can accommodate both standard transfers (by signature) and advanced zero-knowledge transfers. This is useful if you want both typical user experience and the flexibility of programmatic/automated moves.

**Pausing and Approvals**

- If `isPaused = true` for the NFT, nobody can call `approveAddress` or `transfer` unless your code explicitly permits it.
- If the entire collection’s `isPaused = true`, it might override the NFT’s own flags or block collection-level operations such as minting or upgrading.

**Fee Combinations**

- Setting a small `transferFee` in combination with a higher `royaltyFee` can give you both a predictable base revenue (transferFee) and a scalable portion (royaltyFee) of the resale price.

**Locking Down Forever**

- If you set `canChangeMetadata = false`, `canChangeStorage = false`, `canChangeName = false`, and `canApprove = false`, then the NFT is effectively “locked.” Ownership might still be changed if `canTransfer = true` or `canChangeOwnerByProof = true`.

**Admin-Gated Transfers**

- For collections that need strict oversight, `requireTransferApproval = true` ensures all transfers must go through your admin contract, letting you audit or veto each trade.

**Protecting Upgrades**

- If `requireOwnerAuthorizationToUpgrade = true` on the NFT while your collection also checks for that, the NFT’s logic can only be upgraded if the current owner signs off. This prevents malicious or unintended upgrades by the original issuer once the NFT has a new owner.

By thoughtfully combining these flags, you can fine-tune everything from who controls the NFT’s data and transfers, to how fees are collected, to how quickly you can shut down the collection if problems arise. Balancing flexibility, security, and user experience is key.
