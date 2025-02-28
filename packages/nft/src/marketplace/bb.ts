import {
  AccountUpdate,
  DeployArgs,
  method,
  Permissions,
  PublicKey,
  State,
  state,
  UInt64,
  SmartContract,
  Bool,
  Field,
  Struct,
  VerificationKey,
} from "o1js";
/**
 * The BulletinBoard contract serves as a centralized event emitter for NFT marketplace activities.
 * It provides a standardized way to broadcast and track various marketplace events such as:
 * - New collection listings
 * - Offers made on NFTs
 * - Offer cancellations
 * - Bids placed on NFTs
 * - Bid cancellations
 * - Completed sales
 *
 * While anyone can emit events through this contract, all events are prefixed with "BB_" to
 * distinguish them from events emitted directly by NFT contracts. This helps maintain clarity
 * in event tracking and marketplace activity monitoring.
 *
 * The BulletinBoard does not handle any NFT transfers or escrow - it purely exists as an
 * event broadcasting mechanism to help indexers and UIs track marketplace activity.
 */

export {
  BB_NewCollectionEvent,
  BB_OfferEvent,
  BB_CancelOfferEvent,
  BB_BidEvent,
  BB_CancelBidEvent,
  BB_SaleEvent,
  BB_UpgradeVerificationKeyEvent,
  BB_ChangeAdminEvent,
  BulletinBoard,
  BulletinBoardDeployProps,
};

class BB_NewCollectionEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
}) {}

class BB_OfferEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
  /** The NFT address. */
  nft: PublicKey,
  /** The offer address. */
  offer: PublicKey,
  /** The price. */
  price: UInt64,
}) {}

class BB_CancelOfferEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
  /** The NFT address. */
  nft: PublicKey,
}) {}

class BB_BidEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
  /** The NFT address. */
  nft: PublicKey,
  /** The bid address. */
  bid: PublicKey,
  /** The price. */
  price: UInt64,
}) {}

class BB_CancelBidEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
  /** The NFT address. */
  nft: PublicKey,
  /** The bid address. */
  bid: PublicKey,
}) {}

class BB_SaleEvent extends Struct({
  /** The collection address. */
  collection: PublicKey,
  /** The NFT address. */
  nft: PublicKey,
  /** The buyer address. */
  buyer: PublicKey,
  /** The price. */
  price: UInt64,
}) {}

class BB_UpgradeVerificationKeyEvent extends Struct({
  /** The new verification key. */
  vk: Field,
}) {}

class BB_ChangeAdminEvent extends Struct({
  /** The new admin. */
  admin: PublicKey,
}) {}

interface BulletinBoardDeployProps extends Exclude<DeployArgs, undefined> {
  /** The admin. */
  admin: PublicKey;
}
/**
 * The BulletinBoard contract serves as a centralized event emitter for NFT marketplace activities.
 * It provides a standardized way to broadcast and track various marketplace events such as:
 * - New collection listings
 * - Offers made on NFTs
 * - Offer cancellations
 * - Bids placed on NFTs
 * - Bid cancellations
 * - Completed sales
 *
 * While anyone can emit events through this contract, all events are prefixed with "BB_" to
 * distinguish them from events emitted directly by NFT contracts. This helps maintain clarity
 * in event tracking and marketplace activity monitoring.
 */
class BulletinBoard extends SmartContract {
  @state(PublicKey) admin = State<PublicKey>();

  async deploy(args: BulletinBoardDeployProps) {
    await super.deploy(args);
    this.admin.set(args.admin);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
      setVerificationKey:
        Permissions.VerificationKey.proofDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
    });
  }

  events = {
    newCollection: BB_NewCollectionEvent,
    offer: BB_OfferEvent,
    cancelOffer: BB_CancelOfferEvent,
    bid: BB_BidEvent,
    cancelBid: BB_CancelBidEvent,
    sale: BB_SaleEvent,
    upgradeVerificationKey: BB_UpgradeVerificationKeyEvent,
    changeAdmin: BB_ChangeAdminEvent,
  };

  /**
   * Emits a new collection event.
   * @param collection - The collection address.
   */
  @method async newCollection(collection: PublicKey) {
    this.emitEvent(
      "newCollection",
      new BB_NewCollectionEvent({
        collection,
      })
    );
  }

  /**
   * Emits an offer event.
   * @param collection - The collection address.
   * @param nft - The NFT address.
   * @param offer - The offer address.
   * @param price - The price.
   */
  @method async offer(
    collection: PublicKey,
    nft: PublicKey,
    offer: PublicKey,
    price: UInt64
  ) {
    this.emitEvent(
      "offer",
      new BB_OfferEvent({ collection, nft, offer, price })
    );
  }

  /**
   * Emits a cancel offer event.
   * @param collection - The collection address.
   * @param nft - The NFT address.
   */
  @method async cancelOffer(collection: PublicKey, nft: PublicKey) {
    this.emitEvent("cancelOffer", new BB_CancelOfferEvent({ collection, nft }));
  }

  /**
   * Emits a bid event.
   * @param collection - The collection address.
   * @param nft - The NFT address.
   * @param bid - The bid address.
   * @param price - The price.
   */
  @method async bid(
    collection: PublicKey,
    nft: PublicKey,
    bid: PublicKey,
    price: UInt64
  ) {
    this.emitEvent("bid", new BB_BidEvent({ collection, nft, bid, price }));
  }

  /**
   * Emits a cancel bid event.
   * @param collection - The collection address.
   * @param nft - The NFT address.
   * @param bid - The bid address.
   */
  @method async cancelBid(
    collection: PublicKey,
    nft: PublicKey,
    bid: PublicKey
  ) {
    this.emitEvent(
      "cancelBid",
      new BB_CancelBidEvent({ collection, nft, bid })
    );
  }

  /**
   * Emits a sale event.
   * @param collection - The collection address.
   * @param nft - The NFT address.
   * @param buyer - The buyer address.
   * @param price - The price.
   */
  @method async sale(
    collection: PublicKey,
    nft: PublicKey,
    buyer: PublicKey,
    price: UInt64
  ) {
    this.emitEvent("sale", new BB_SaleEvent({ collection, nft, buyer, price }));
  }

  /**
   * Ensures that the transaction is authorized by the contract owner.
   * @returns A signed `AccountUpdate` from the admin.
   */
  async ensureOwnerSignature(): Promise<AccountUpdate> {
    const admin = this.admin.getAndRequireEquals();
    const adminUpdate = AccountUpdate.createSigned(admin);
    adminUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
    return adminUpdate;
  }

  /**
   * Changes the contract's admin
   * @param admin - The new admin.
   */
  @method
  async changeAdmin(admin: PublicKey) {
    await this.ensureOwnerSignature();

    // Set the new admin
    this.admin.set(admin);

    // Emit the change admin event
    this.emitEvent("changeAdmin", new BB_ChangeAdminEvent({ admin }));
  }

  /**
   * Upgrades the contract's verification key after validating with the upgrade authority.
   * @param vk - The new verification key to upgrade to.
   */
  @method
  async upgradeVerificationKey(vk: VerificationKey) {
    await this.ensureOwnerSignature();

    // Set the new verification key
    this.account.verificationKey.set(vk);

    // Emit the upgrade event
    this.emitEvent(
      "upgradeVerificationKey",
      new BB_UpgradeVerificationKeyEvent({ vk: vk.hash })
    );
  }
}
