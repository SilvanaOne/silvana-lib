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
  Poseidon,
  Provable,
} from "o1js";
import { Whitelist, OffChainList, Storage } from "@silvana-one/storage";
import {
  NFTAddress,
  SellEvent,
  DepositEvent,
  WithdrawEvent,
  BidEvent,
} from "./types.js";
import {
  NFTCollectionBase,
  NFTCollectionContractConstructor,
  TransferParams,
  UInt64Option,
  NFTTransactionContext,
} from "../interfaces/index.js";

export class Bid extends Struct({
  price: UInt64,
  points: UInt64,
}) {
  pack() {
    return Field.fromBits([
      ...this.price.value.toBits(64),
      ...this.points.value.toBits(64),
    ]);
  }
  static unpack(field: Field): Bid {
    const bits = field.toBits(64 + 64);
    const price = UInt64.Unsafe.fromField(Field.fromBits(bits.slice(0, 64)));
    const points = UInt64.Unsafe.fromField(
      Field.fromBits(bits.slice(64, 64 + 64))
    );
    return new Bid({
      price,
      points,
    });
  }
}

export interface NonFungibleTokenBidContractDeployProps
  extends Exclude<DeployArgs, undefined> {
  /** The whitelist. */
  whitelist: Field;
  /** The offers. */
  bids: Field;
  /** The storage. */
  storage: Storage;
}

export function BidFactory(params: {
  collectionContract: () => NFTCollectionContractConstructor;
}) {
  const { collectionContract } = params;
  class NonFungibleTokenBidContract extends SmartContract {
    @state(PublicKey) buyer = State<PublicKey>();
    @state(Field) whitelist = State<Field>();
    @state(Field) bids = State<Field>();
    @state(Storage) storage = State<Storage>();
    @state(UInt64) maxPoints = State<UInt64>();
    // We do not have concurrency here, but given that it is a single-user contract,
    // we can use state to track the points that have been consumed
    // In case of concurrency, we can use the tokens to track the points
    @state(UInt64) consumedPoints = State<UInt64>();

    async deploy(args: NonFungibleTokenBidContractDeployProps) {
      await super.deploy(args);
      this.whitelist.set(args.whitelist);
      this.bids.set(args.bids);
      this.storage.set(args.storage);
      this.account.permissions.set({
        ...Permissions.default(),
        send: Permissions.proof(),
        setVerificationKey:
          Permissions.VerificationKey.impossibleDuringCurrentVersion(),
        setPermissions: Permissions.impossible(),
      });
    }

    events = {
      deposit: DepositEvent,
      withdraw: WithdrawEvent,
      sell: SellEvent,
      updateWhitelist: Whitelist,
      bid: BidEvent,
    };

    @method async initialize(amount: UInt64, maxPoints: UInt64) {
      this.account.provedState.requireEquals(Bool(false));

      const buyer = this.sender.getUnconstrained();
      const buyerUpdate = AccountUpdate.createSigned(buyer);
      // We use low-level subInPlace and addInPlace to decrease the number of AccountUpdates
      buyerUpdate.balance.subInPlace(amount.add(UInt64.from(1_000_000_000)));
      this.self.balance.addInPlace(amount);
      buyerUpdate.body.useFullCommitment = Bool(true);

      this.buyer.set(buyer);
      this.maxPoints.set(maxPoints);
      this.emitEvent(
        "deposit",
        new DepositEvent({
          buyer,
          amount,
          maxPoints,
        })
      );
    }

    getCollectionContract(address: PublicKey): NFTCollectionBase {
      const CollectionContract = collectionContract();
      return new CollectionContract(address);
    }

    @method async deposit(amount: UInt64, maxPoints: UInt64) {
      amount.equals(UInt64.from(0)).assertFalse();

      const sender = this.sender.getUnconstrained();
      const buyer = this.buyer.getAndRequireEquals();
      sender.assertEquals(buyer);
      const buyerUpdate = AccountUpdate.createSigned(buyer);
      buyerUpdate.send({ to: this.address, amount });
      buyerUpdate.body.useFullCommitment = Bool(true);

      this.maxPoints.set(maxPoints);

      this.emitEvent(
        "deposit",
        new DepositEvent({
          buyer,
          amount,
          maxPoints,
        })
      );
    }

    @method async withdraw(amount: UInt64, maxPoints: UInt64) {
      amount.equals(UInt64.from(0)).assertFalse();
      this.account.balance.requireBetween(amount, UInt64.MAXINT());

      const buyer = this.buyer.getAndRequireEquals();
      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.body.useFullCommitment = Bool(true);
      sender.assertEquals(buyer);

      let bidUpdate = this.send({ to: senderUpdate, amount });
      bidUpdate.body.useFullCommitment = Bool(true);
      this.maxPoints.set(maxPoints);
      this.emitEvent(
        "withdraw",
        new WithdrawEvent({
          buyer,
          amount,
          maxPoints,
        })
      );
    }

    @method async sell(nftAddress: NFTAddress, price: UInt64) {
      await this._sell(nftAddress, price);
      const buyer = this.buyer.getAndRequireEquals();
      const Collection = collectionContract();
      const collection = new Collection(nftAddress.collection);
      await collection.transferBySignature(
        new TransferParams({
          address: nftAddress.nft,
          from: PublicKey.empty(),
          to: buyer,
          price: UInt64Option.fromValue(price),
          context: new NFTTransactionContext({
            custom: [Field(0), Field(0), Field(0)],
          }),
        })
      );
    }

    @method async approvedSell(nftAddress: NFTAddress, price: UInt64) {
      await this._sell(nftAddress, price);
      const buyer = this.buyer.getAndRequireEquals();
      const Collection = collectionContract();
      const collection = new Collection(nftAddress.collection);
      await collection.approvedTransferBySignature(
        new TransferParams({
          address: nftAddress.nft,
          from: PublicKey.empty(),
          to: buyer,
          price: UInt64Option.fromValue(price),
          context: new NFTTransactionContext({
            custom: [Field(0), Field(0), Field(0)],
          }),
        })
      );
    }

    async _sell(nftAddress: NFTAddress, price: UInt64) {
      price.equals(UInt64.from(0)).assertFalse();
      const key = Poseidon.hashPacked(NFTAddress, nftAddress);
      const storage = this.storage.getAndRequireEquals();
      const bids = new OffChainList({
        root: this.bids.getAndRequireEquals(),
        storage,
      });
      const bid = Bid.unpack(
        (await bids.getValue(key, "bids")).assertSome("bid not found")
      );

      // We do not require the price to be equal to the bid price,
      // because the price can be lower than the bid price
      // and the seller can still be willing to sell the NFT
      // as the deposit remaining is less than bid price
      price.assertLessThanOrEqual(bid.price, "price is too high");
      this.account.balance.requireBetween(price, UInt64.MAXINT());

      const consumedPoints = this.consumedPoints.getAndRequireEquals();
      const maxPoints = this.maxPoints.getAndRequireEquals();
      const newConsumedPoints = consumedPoints.add(bid.points);
      newConsumedPoints.assertLessThanOrEqual(
        maxPoints,
        "consumed points exceed max points"
      );
      this.consumedPoints.set(newConsumedPoints);

      const seller = this.sender.getUnconstrained();
      const sellerUpdate = AccountUpdate.createSigned(seller);
      sellerUpdate.balance.addInPlace(price);
      this.self.balance.subInPlace(price);
      sellerUpdate.body.useFullCommitment = Bool(true);

      const whitelist = new Whitelist({
        list: new OffChainList({
          root: this.whitelist.getAndRequireEquals(),
          storage,
        }),
      });
      const whitelistedAmount = await whitelist.getWhitelistedAmount(
        seller,
        "whitelist"
      );
      const whitelistDisabled = whitelist.isNone();
      whitelistedAmount.isSome
        .or(whitelistDisabled)
        .assertTrue("Cannot buy from non-whitelisted address");
      const maxPrice = Provable.if(
        whitelistDisabled,
        UInt64.MAXINT(),
        whitelistedAmount.value
      );
      price.assertLessThanOrEqual(
        maxPrice,
        "price is higher than whitelisted price"
      );

      this.emitEvent(
        "sell",
        new SellEvent({
          collection: nftAddress.collection,
          nft: nftAddress.nft,
          price,
        })
      );
    }

    @method async bid(bids: Field, whitelist: Field, storage: Storage) {
      const buyer = this.buyer.getAndRequireEquals();
      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.body.useFullCommitment = Bool(true);
      sender.assertEquals(buyer);

      this.bids.set(bids);
      this.whitelist.set(whitelist);
      this.storage.set(storage);
      this.emitEvent("bid", new BidEvent({ bids, whitelist, storage }));
    }
  }

  return NonFungibleTokenBidContract;
}
