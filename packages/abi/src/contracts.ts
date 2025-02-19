import {
  FungibleToken,
  AdvancedFungibleToken,
  FungibleTokenAdmin,
  FungibleTokenAdvancedAdmin,
  FungibleTokenBidContract,
  FungibleTokenOfferContract,
  FungibleTokenClaimContract,
} from "@silvana-one/token";
import {
  NFT,
  Collection,
  AdvancedCollection,
  NFTAdmin,
  NFTAdvancedAdmin,
} from "@silvana-one/nft";
import { VerificationKeyUpgradeAuthority } from "@silvana-one/upgradable";
import { Compilable } from "./compile.js";

export const contractList: Record<string, Compilable> = {
  FungibleToken: FungibleToken,
  FungibleTokenAdmin: FungibleTokenAdmin,
  AdvancedFungibleToken: AdvancedFungibleToken,
  FungibleTokenAdvancedAdmin: FungibleTokenAdvancedAdmin,
  FungibleTokenBidContract: FungibleTokenBidContract,
  FungibleTokenOfferContract: FungibleTokenOfferContract,
  FungibleTokenClaimContract: FungibleTokenClaimContract,
  NFT: NFT,
  Collection: Collection,
  AdvancedCollection: AdvancedCollection,
  NFTAdmin: NFTAdmin,
  NFTAdvancedAdmin: NFTAdvancedAdmin,
  VerificationKeyUpgradeAuthority: VerificationKeyUpgradeAuthority,
};
