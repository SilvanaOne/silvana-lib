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
} from "o1js";
import { Whitelist } from "@silvana-one/storage";
import { FungibleToken } from "./FungibleToken.js";
import { mulDiv } from "./div.js";

export interface FungibleTokenBidContractDeployProps
  extends Exclude<DeployArgs, undefined> {
  /** The whitelist. */
  whitelist: Whitelist;
}

export class BidEvent extends Struct({
  amount: UInt64,
  address: PublicKey,
}) {}

export class FungibleTokenBidContract extends SmartContract {
  @state(UInt64) price = State<UInt64>();
  @state(PublicKey) buyer = State<PublicKey>();
  @state(PublicKey) token = State<PublicKey>();
  @state(Whitelist) whitelist = State<Whitelist>();

  async deploy(args: FungibleTokenBidContractDeployProps) {
    await super.deploy(args);
    this.whitelist.set(args.whitelist);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
      setVerificationKey:
        Permissions.VerificationKey.impossibleDuringCurrentVersion(),
      setPermissions: Permissions.impossible(),
    });
  }

  events = {
    bid: BidEvent,
    withdraw: BidEvent,
    sell: BidEvent,
    updateWhitelist: Whitelist,
  };

  @method async initialize(token: PublicKey, amount: UInt64, price: UInt64) {
    this.account.provedState.requireEquals(Bool(false));
    amount.equals(UInt64.from(0)).assertFalse();

    const totalPrice = mulDiv({
      value: price,
      multiplier: amount,
      denominator: UInt64.from(1_000_000_000),
    }).result;

    const buyer = this.sender.getUnconstrained();
    const buyerUpdate = AccountUpdate.createSigned(buyer);
    buyerUpdate.send({ to: this.address, amount: totalPrice });
    buyerUpdate.body.useFullCommitment = Bool(true);

    this.buyer.set(buyer);
    this.price.set(price);
    this.token.set(token);
    this.emitEvent("bid", { amount, address: buyer } as BidEvent);
  }

  @method async bid(amount: UInt64, price: UInt64) {
    amount.equals(UInt64.from(0)).assertFalse();

    const balance = this.account.balance.getAndRequireEquals();
    const oldPrice = this.price.getAndRequireEquals();
    // Price can be changed only when the balance is 0
    price
      .equals(oldPrice)
      .or(balance.equals(UInt64.from(0)))
      .assertTrue();
    this.price.set(price);

    const totalPrice = mulDiv({
      value: price,
      multiplier: amount,
      denominator: UInt64.from(1_000_000_000),
    }).result;

    const sender = this.sender.getUnconstrained();
    const buyer = this.buyer.getAndRequireEquals();
    sender.assertEquals(buyer);
    const buyerUpdate = AccountUpdate.createSigned(buyer);
    buyerUpdate.send({ to: this.address, amount: totalPrice });
    buyerUpdate.body.useFullCommitment = Bool(true);

    this.price.set(price);
    this.emitEvent("bid", { amount, address: buyer } as BidEvent);
  }

  @method async withdraw(amountInMina: UInt64) {
    amountInMina.equals(UInt64.from(0)).assertFalse();
    this.account.balance.requireBetween(amountInMina, UInt64.MAXINT());

    const buyer = this.buyer.getAndRequireEquals();
    const sender = this.sender.getUnconstrained();
    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.body.useFullCommitment = Bool(true);
    sender.assertEquals(buyer);

    let bidUpdate = this.send({ to: senderUpdate, amount: amountInMina });
    bidUpdate.body.useFullCommitment = Bool(true);
    this.emitEvent("withdraw", {
      amount: amountInMina,
      address: buyer,
    } as BidEvent);
  }

  @method async sell(amount: UInt64) {
    amount.equals(UInt64.from(0)).assertFalse();
    const price = this.price.getAndRequireEquals();
    const totalPrice = mulDiv({
      value: price,
      multiplier: amount,
      denominator: UInt64.from(1_000_000_000),
    }).result;

    this.account.balance.requireBetween(totalPrice, UInt64.MAXINT());
    const buyer = this.buyer.getAndRequireEquals();
    const token = this.token.getAndRequireEquals();

    const seller = this.sender.getUnconstrained();
    const sellerUpdate = this.send({ to: seller, amount: totalPrice });
    sellerUpdate.body.useFullCommitment = Bool(true);
    sellerUpdate.requireSignature();

    const tokenContract = new FungibleToken(token);
    await tokenContract.transfer(seller, buyer, amount);

    const whitelist = this.whitelist.getAndRequireEquals();
    const whitelistedAmount = await whitelist.getWhitelistedAmount(seller);
    amount.assertLessThanOrEqual(
      whitelistedAmount.assertSome("Cannot sell more than whitelisted amount")
    );
    this.emitEvent("sell", { amount, address: seller } as BidEvent);
  }

  @method async updateWhitelist(whitelist: Whitelist) {
    const buyer = this.buyer.getAndRequireEquals();
    const sender = this.sender.getUnconstrained();
    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.body.useFullCommitment = Bool(true);
    sender.assertEquals(buyer);

    this.whitelist.set(whitelist);
    this.emitEvent("updateWhitelist", whitelist);
  }
}
