import { PublicKey, UInt64, Bool, Field, Struct } from "o1js";
import { Storage } from "@silvana-one/storage";

export { NFTAddress, SellEvent, DepositEvent, WithdrawEvent, BidEvent };

class NFTAddress extends Struct({
  collection: PublicKey,
  nft: PublicKey,
}) {}

class SellEvent extends Struct({
  collection: PublicKey,
  nft: PublicKey,
  price: UInt64,
}) {}

class DepositEvent extends Struct({
  buyer: PublicKey,
  amount: UInt64,
  maxPoints: UInt64,
}) {}

class WithdrawEvent extends Struct({
  buyer: PublicKey,
  amount: UInt64,
  maxPoints: UInt64,
}) {}

class BidEvent extends Struct({
  bids: Field,
  whitelist: Field,
  storage: Storage,
}) {}
