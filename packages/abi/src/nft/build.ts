import { Whitelist, Storage, IndexedMapSerialized } from "@silvana-one/storage";
import {
  NftTransactionType,
  NftTransactionParams,
  LaunchNftCollectionStandardAdminParams,
  LaunchNftCollectionAdvancedAdminParams,
  NftMintTransactionParams,
  getCurrentZekoSlot,
} from "@silvana-one/api";
import { blockchain } from "../types.js";
import { fetchMinaAccount } from "../fetch.js";
import {
  Collection,
  Admin,
  NFT,
  AdvancedCollection,
  NFTAdmin,
  NFTAdvancedAdmin,
  Offer,
  AdvancedOffer,
  Metadata,
  pinMetadata,
  fieldFromString,
  CollectionData,
  MintParams,
  NFTData,
  fieldToString,
  TransferBySignatureParams,
  UInt64Option,
  NFTTransactionContext,
} from "@silvana-one/nft";
import { tokenVerificationKeys } from "../vk/index.js";
import {
  PublicKey,
  Mina,
  AccountUpdate,
  UInt64,
  UInt8,
  Bool,
  Transaction,
  Struct,
  Field,
  TokenId,
  UInt32,
  fetchLastBlock,
} from "o1js";

export type NftAdminType = "standard" | "advanced" | "unknown";

export async function buildNftCollectionLaunchTransaction(params: {
  chain: blockchain;
  args:
    | LaunchNftCollectionStandardAdminParams
    | LaunchNftCollectionAdvancedAdminParams;
  developerAddress?: string;
  provingKey?: string;
  provingFee?: number;
}): Promise<{
  request:
    | LaunchNftCollectionStandardAdminParams
    | LaunchNftCollectionAdvancedAdminParams;
  tx: Transaction<false, false>;
  adminType: NftAdminType;
  collectionName: string;
  nftName: string;
  verificationKeyHashes: string[];
  metadataRoot: string;
  storage: string;
  privateMetadata?: string;
  map?: IndexedMapSerialized;
}> {
  const { chain, args } = params;
  const ACCOUNT_CREATION_FEE: bigint =
    chain === "zeko" ? 100_000_000n : 1_000_000_000n;
  const {
    url = chain === "mainnet"
      ? "https://minanft.io"
      : `https://${chain}.minanft.io`,
    symbol = "NFT",
    memo,
    nonce,
    adminContract: adminType,
    masterNFT,
  } = args;

  if (memo && typeof memo !== "string")
    throw new Error("Memo must be a string");
  if (memo && memo.length > 30)
    throw new Error("Memo must be less than 30 characters");
  if (!symbol || typeof symbol !== "string")
    throw new Error("Symbol must be a string");
  if (symbol.length >= 7)
    throw new Error("Symbol must be less than 7 characters");
  if (masterNFT === undefined) {
    throw new Error("masterNFT is required");
  }
  if (masterNFT.metadata === undefined) {
    throw new Error("masterNFT.metadata is required");
  }
  if (
    typeof masterNFT.metadata === "string" &&
    masterNFT.storage === undefined
  ) {
    throw new Error("masterNFT.storage is required if metadata is a string");
  }
  const sender = PublicKey.fromBase58(args.sender);
  if (nonce === undefined) throw new Error("Nonce is required");
  if (typeof nonce !== "number") throw new Error("Nonce must be a number");
  const fee = args.fee ?? 200_000_000;
  if (url && typeof url !== "string") throw new Error("Url must be a string");
  if (!args.collectionAddress || typeof args.collectionAddress !== "string")
    throw new Error("collectionAddress is required");
  if (!args.collectionName || typeof args.collectionName !== "string")
    throw new Error("collectionName is required");
  const collectionName = args.collectionName;
  if (
    !args.adminContractAddress ||
    typeof args.adminContractAddress !== "string"
  )
    throw new Error("adminContractAddress is required");

  const adminContract = adminType === "advanced" ? NFTAdvancedAdmin : NFTAdmin;
  const collectionContract =
    adminType === "advanced" ? AdvancedCollection : Collection;
  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  if (
    !vk ||
    !vk.Collection ||
    !vk.Collection.hash ||
    !vk.Collection.data ||
    !vk.AdvancedCollection ||
    !vk.AdvancedCollection.hash ||
    !vk.AdvancedCollection.data ||
    !vk.NFT ||
    !vk.NFT.hash ||
    !vk.NFT.data ||
    !vk.NFTAdmin ||
    !vk.NFTAdmin.hash ||
    !vk.NFTAdmin.data ||
    !vk.NFTAdvancedAdmin ||
    !vk.NFTAdvancedAdmin.hash ||
    !vk.NFTAdvancedAdmin.data
  )
    throw new Error("Cannot get verification key from vk");

  const adminVerificationKey =
    adminType === "advanced" ? vk.NFTAdvancedAdmin : vk.NFTAdmin;
  const collectionVerificationKey =
    adminType === "advanced" ? vk.AdvancedCollection : vk.Collection;

  if (!adminVerificationKey || !collectionVerificationKey)
    throw new Error("Cannot get verification keys");
  await fetchMinaAccount({
    publicKey: sender,
    force: true,
  });

  if (!Mina.hasAccount(sender)) {
    throw new Error("Sender does not have account");
  }

  const whitelist =
    "whitelist" in args && args.whitelist
      ? typeof args.whitelist === "string"
        ? Whitelist.fromString(args.whitelist)
        : (await Whitelist.create({ list: args.whitelist, name: symbol }))
            .whitelist
      : Whitelist.empty();

  const collectionAddress = PublicKey.fromBase58(args.collectionAddress);
  const adminContractAddress = PublicKey.fromBase58(args.adminContractAddress);
  const creator = args.creator ? PublicKey.fromBase58(args.creator) : sender;
  const zkCollection = new collectionContract(collectionAddress);
  const zkAdmin = new adminContract(adminContractAddress);
  const metadataVerificationKeyHash = masterNFT.metadataVerificationKeyHash
    ? Field.fromJSON(masterNFT.metadataVerificationKeyHash)
    : Field(0);

  const provingKey = params.provingKey
    ? PublicKey.fromBase58(params.provingKey)
    : sender;
  const provingFee = params.provingFee
    ? UInt64.from(Math.round(params.provingFee))
    : undefined;
  const developerFee = args.developerFee
    ? UInt64.from(Math.round(args.developerFee))
    : undefined;
  const developerAddress = params.developerAddress
    ? PublicKey.fromBase58(params.developerAddress)
    : undefined;

  const { name, ipfsHash, metadataRoot, privateMetadata, serializedMap } =
    typeof masterNFT.metadata === "string"
      ? {
          name: masterNFT.name,
          ipfsHash: masterNFT.storage,
          metadataRoot: Field.fromJSON(masterNFT.metadata),
          privateMetadata: undefined,
          serializedMap: undefined,
        }
      : await pinMetadata(
          Metadata.fromOpenApiJSON({ json: masterNFT.metadata })
        );

  if (ipfsHash === undefined)
    throw new Error("storage is required, but not provided");
  if (metadataRoot === undefined) throw new Error("metadataRoot is required");

  const slot =
    chain === "local"
      ? Mina.currentSlot()
      : chain === "zeko"
      ? UInt32.from((await getCurrentZekoSlot("zeko")) ?? 2_000_000)
      : (await fetchLastBlock()).globalSlotSinceGenesis;
  const expiry = slot.add(UInt32.from(100));
  if (chain === "zeko") {
    console.log("zeko slot", slot.toBigint());
    console.log("zeko expiry", expiry.toBigint());
  }

  const nftData = NFTData.new({
    owner: creator,
    approved: undefined,
    version: undefined,
    id: masterNFT.data.id ? BigInt(masterNFT.data.id) : undefined,
    canChangeOwnerByProof: masterNFT.data.canChangeOwnerByProof,
    canTransfer: masterNFT.data.canTransfer,
    canApprove: masterNFT.data.canApprove,
    canChangeMetadata: masterNFT.data.canChangeMetadata,
    canChangeStorage: masterNFT.data.canChangeStorage,
    canChangeName: masterNFT.data.canChangeName,
    canChangeMetadataVerificationKeyHash:
      masterNFT.data.canChangeMetadataVerificationKeyHash,
    canPause: masterNFT.data.canPause,
    isPaused: masterNFT.data.isPaused,
    requireOwnerAuthorizationToUpgrade:
      masterNFT.data.requireOwnerAuthorizationToUpgrade,
  });

  const mintParams = new MintParams({
    name: fieldFromString(name),
    address: collectionAddress,
    tokenId: TokenId.derive(collectionAddress),
    data: nftData,
    fee: args.masterNFT.fee
      ? UInt64.from(Math.round(args.masterNFT.fee * 1_000_000_000))
      : UInt64.zero,
    metadata: metadataRoot,
    storage: Storage.fromString(ipfsHash),
    metadataVerificationKeyHash,
    expiry: masterNFT.expiry
      ? UInt32.from(Math.round(masterNFT.expiry))
      : expiry,
  });

  const collectionData = CollectionData.new(args.collectionData ?? {});

  const tx = await Mina.transaction(
    {
      sender,
      fee,
      memo:
        memo ?? `${args.collectionName} NFT collection launch`.substring(0, 30),
      nonce,
    },
    async () => {
      const feeAccountUpdate = AccountUpdate.createSigned(sender);
      feeAccountUpdate.balance.subInPlace(3n * ACCOUNT_CREATION_FEE);

      if (provingFee && provingKey)
        feeAccountUpdate.send({
          to: provingKey,
          amount: provingFee,
        });
      if (developerAddress && developerFee) {
        feeAccountUpdate.send({
          to: developerAddress,
          amount: developerFee,
        });
      }

      if (zkAdmin instanceof NFTAdvancedAdmin) {
        throw new Error("Advanced admin is not supported");
      } else if (zkAdmin instanceof NFTAdmin) {
        await zkAdmin.deploy({
          admin: sender,
          uri: `NFT Admin`,
          verificationKey: adminVerificationKey,
        });
        // deploy() and initialize() create 2 account updates for the same publicKey, it is intended
        await zkCollection.deploy({
          creator,
          collectionName: fieldFromString(collectionName),
          baseURL: fieldFromString(args.baseURL ?? "ipfs"),
          admin: adminContractAddress,
          symbol,
          url,
          verificationKey: collectionVerificationKey,
        });
        await zkCollection.initialize(mintParams, collectionData);
      }
    }
  );
  return {
    request:
      adminType === "advanced"
        ? {
            ...args,
            whitelist: whitelist.toString(),
          }
        : args,
    tx,
    adminType,
    collectionName,
    nftName: name,
    verificationKeyHashes: [
      adminVerificationKey.hash,
      collectionVerificationKey.hash,
    ],
    metadataRoot: metadataRoot.toJSON(),
    storage: ipfsHash,
    privateMetadata,
    map: serializedMap,
  };
}

export async function buildNftTransaction(params: {
  chain: blockchain;
  args: Exclude<
    NftTransactionParams,
    | LaunchNftCollectionStandardAdminParams
    | LaunchNftCollectionAdvancedAdminParams
    | NftMintTransactionParams
  >;
  developerAddress?: string;
  provingKey?: string;
  provingFee?: number;
}): Promise<{
  request: Exclude<
    NftTransactionParams,
    | LaunchNftCollectionStandardAdminParams
    | LaunchNftCollectionAdvancedAdminParams
    | NftMintTransactionParams
  >;
  tx: Transaction<false, false>;
  adminType: NftAdminType;
  adminContractAddress: PublicKey;
  symbol: string;
  collectionName: string;
  nftName: string;
  verificationKeyHashes: string[];
  metadataRoot: string;
  storage: string;
  privateMetadata?: string;
  map?: IndexedMapSerialized;
}> {
  const { chain, args } = params;
  const ACCOUNT_CREATION_FEE: bigint =
    chain === "zeko" ? 100_000_000n : 1_000_000_000n;
  const { nonce, txType } = args;
  if (nonce === undefined) throw new Error("Nonce is required");
  if (typeof nonce !== "number") throw new Error("Nonce must be a number");
  if (txType === undefined) throw new Error("Tx type is required");
  if (typeof txType !== "string") throw new Error("Tx type must be a string");
  if (args.sender === undefined || typeof args.sender !== "string")
    throw new Error("Sender is required");
  if (
    args.collectionAddress === undefined ||
    typeof args.collectionAddress !== "string"
  )
    throw new Error("Collection address is required");
  if (args.nftAddress === undefined || typeof args.nftAddress !== "string")
    throw new Error("NFT address is required");
  const sender = PublicKey.fromBase58(args.sender);
  const collectionAddress = PublicKey.fromBase58(args.collectionAddress);
  if (txType === "nft:transfer" && args.nftTransferParams === undefined) {
    throw new Error("NFT transfer params are required");
  }
  if (txType === "nft:sell" && args.nftSellParams === undefined) {
    throw new Error("NFT sell params are required");
  }
  if (txType === "nft:buy" && args.nftBuyParams === undefined) {
    throw new Error("NFT buy params are required");
  }
  const nftAddress = PublicKey.fromBase58(args.nftAddress);

  let offerAddress =
    "nftSellParams" in args &&
    args.nftSellParams &&
    args.nftSellParams.offerAddress
      ? PublicKey.fromBase58(args.nftSellParams.offerAddress)
      : undefined;
  if (!offerAddress && txType === "nft:sell")
    throw new Error("Offer address is required");

  // const bidAddress =
  //   "bidAddress" in args && args.bidAddress
  //     ? PublicKey.fromBase58(args.bidAddress)
  //     : undefined;
  // if (
  //   !bidAddress &&
  //   (txType === "token:bid:create" ||
  //     txType === "token:bid:sell" ||
  //     txType === "token:bid:withdraw")
  // )
  //   throw new Error("Bid address is required");

  let to =
    txType === "nft:transfer"
      ? "nftTransferParams" in args &&
        args.nftTransferParams &&
        args.nftTransferParams.to &&
        typeof args.nftTransferParams.to === "string"
        ? PublicKey.fromBase58(args.nftTransferParams.to)
        : undefined
      : txType === "nft:approve"
      ? "nftApproveParams" in args &&
        args.nftApproveParams &&
        args.nftApproveParams.to &&
        typeof args.nftApproveParams.to === "string"
        ? PublicKey.fromBase58(args.nftApproveParams.to)
        : undefined
      : undefined;
  if (!to && txType === "nft:transfer")
    throw new Error("To address is required for nft:transfer");

  if (!to && txType === "nft:approve") to = PublicKey.empty();

  let buyer =
    "nftBuyParams" in args &&
    args.nftBuyParams &&
    args.nftBuyParams.buyer &&
    typeof args.nftBuyParams.buyer === "string"
      ? PublicKey.fromBase58(args.nftBuyParams.buyer)
      : undefined;
  if (!buyer && txType === "nft:buy") buyer = sender;

  const from =
    "nftTransferParams" in args &&
    args.nftTransferParams &&
    args.nftTransferParams.from &&
    typeof args.nftTransferParams.from === "string"
      ? PublicKey.fromBase58(args.nftTransferParams.from)
      : undefined;
  if (!from && txType === "nft:transfer")
    throw new Error("From address is required for nft:transfer");

  const price =
    "nftSellParams" in args
      ? args.nftSellParams &&
        args.nftSellParams.price &&
        typeof args.nftSellParams.price === "number"
        ? UInt64.from(Math.round(args.nftSellParams.price * 1_000_000_000))
        : undefined
      : "nftTransferParams" in args &&
        args.nftTransferParams &&
        args.nftTransferParams.price &&
        typeof args.nftTransferParams.price === "number"
      ? UInt64.from(Math.round(args.nftTransferParams.price * 1_000_000_000))
      : undefined;

  if (price === undefined && txType === "nft:sell")
    throw new Error("Price is required for nft:sell");

  await fetchMinaAccount({
    publicKey: sender,
    force: true,
  });

  if (!Mina.hasAccount(sender)) {
    throw new Error("Sender does not have account");
  }

  const {
    symbol,
    adminContractAddress,
    adminType,
    verificationKeyHashes,
    collectionName,
    nftName,
    storage,
    metadataRoot,
    approved,
  } = await getNftSymbolAndAdmin({
    txType,
    collectionAddress,
    chain,
    nftAddress,
  });

  if (storage === undefined)
    throw new Error("storage is required, but not provided");
  if (metadataRoot === undefined) throw new Error("metadataRoot is required");
  if (nftName === undefined) throw new Error("nftName is required");
  if (approved === undefined) throw new Error("approved is required");
  if (txType === "nft:buy" && approved.equals(PublicKey.empty()).toBoolean())
    throw new Error("approved is required to be non-empty for nft:buy");
  if (
    txType === "nft:buy" &&
    offerAddress !== undefined &&
    !offerAddress.equals(approved).toBoolean()
  )
    throw new Error(
      "offerAddress is required to be the same as approved for nft:buy"
    );
  if (txType === "nft:buy" && offerAddress === undefined)
    offerAddress = approved;

  if (offerAddress !== undefined) {
    await fetchMinaAccount({
      publicKey: offerAddress,
      force: txType === "nft:buy",
    });
  }

  const memo = args.memo ?? `${txType.split(":")[1]} ${symbol} ${nftName}`;
  const fee = args.fee ?? 200_000_000;
  const provingKey = params.provingKey
    ? PublicKey.fromBase58(params.provingKey)
    : sender;
  const provingFee = params.provingFee
    ? UInt64.from(Math.round(params.provingFee))
    : undefined;
  const developerFee = args.developerFee
    ? UInt64.from(Math.round(args.developerFee))
    : undefined;
  const developerAddress = params.developerAddress
    ? PublicKey.fromBase58(params.developerAddress)
    : undefined;

  //const adminContract = new FungibleTokenAdmin(adminContractAddress);
  const advancedAdminContract = new NFTAdvancedAdmin(adminContractAddress);
  const adminContract = new NFTAdmin(adminContractAddress);
  const collectionContract =
    adminType === "advanced" ? AdvancedCollection : Collection;

  // if (
  //   (txType === "token:admin:whitelist" ||
  //     txType === "token:bid:whitelist" ||
  //     txType === "token:offer:whitelist") &&
  //   !args.whitelist
  // ) {
  //   throw new Error("Whitelist is required");
  // }

  // const whitelist =
  //   "whitelist" in args && args.whitelist
  //     ? typeof args.whitelist === "string"
  //       ? Whitelist.fromString(args.whitelist)
  //       : (await Whitelist.create({ list: args.whitelist, name: symbol }))
  //           .whitelist
  //     : Whitelist.empty();

  const zkCollection = new collectionContract(collectionAddress);

  const tokenId = zkCollection.deriveTokenId();

  // if (
  //   txType === "nft:mint" &&
  //   adminType === "standard" &&
  //   adminAddress.toBase58() !== sender.toBase58()
  // )
  //   throw new Error(
  //     "Invalid sender for FungibleToken mint with standard admin"
  //   );

  // await fetchMinaAccount({
  //   publicKey: nftAddress,
  //   tokenId,
  //   force: (
  //     ["nft:transfer"] satisfies NftTransactionType[] as NftTransactionType[]
  //   ).includes(txType),
  // });

  // if (to) {
  //   await fetchMinaAccount({
  //     publicKey: to,
  //     force: false,
  //   });
  // }

  // if (from) {
  //   await fetchMinaAccount({
  //     publicKey: from,
  //     tokenId,
  //     force: false,
  //   });
  // }

  // if (offerAddress)
  //   await fetchMinaAccount({
  //     publicKey: offerAddress,
  //     tokenId,
  //     force: (
  //       [
  //         "token:offer:whitelist",
  //         "token:offer:buy",
  //         "token:offer:withdraw",
  //       ] satisfies TokenTransactionType[] as TokenTransactionType[]
  //     ).includes(txType),
  //   });
  // if (bidAddress)
  //   await fetchMinaAccount({
  //     publicKey: bidAddress,
  //     force: (
  //       [
  //         "token:bid:whitelist",
  //         "token:bid:sell",
  //         "token:bid:withdraw",
  //       ] satisfies TokenTransactionType[] as TokenTransactionType[]
  //     ).includes(txType),
  //   });

  // const offerContract = offerAddress
  //   ? new FungibleTokenOfferContract(offerAddress, tokenId)
  //   : undefined;

  // const bidContract = bidAddress
  //   ? new FungibleTokenBidContract(bidAddress)
  //   : undefined;
  // const offerContractDeployment = offerAddress
  //   ? new FungibleTokenOfferContract(offerAddress, tokenId)
  //   : undefined;
  // const bidContractDeployment = bidAddress
  //   ? new FungibleTokenBidContract(bidAddress)
  //   : undefined;
  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  if (
    !vk ||
    !vk.Collection ||
    !vk.Collection.hash ||
    !vk.Collection.data ||
    !vk.AdvancedCollection ||
    !vk.AdvancedCollection.hash ||
    !vk.AdvancedCollection.data ||
    !vk.NFT ||
    !vk.NFT.hash ||
    !vk.NFT.data ||
    !vk.NFTAdmin ||
    !vk.NFTAdmin.hash ||
    !vk.NFTAdmin.data ||
    !vk.NFTAdvancedAdmin ||
    !vk.NFTAdvancedAdmin.hash ||
    !vk.NFTAdvancedAdmin.data ||
    !vk.NonFungibleTokenOfferContract ||
    !vk.NonFungibleTokenOfferContract.hash ||
    !vk.NonFungibleTokenOfferContract.data ||
    !vk.NonFungibleTokenAdvancedOfferContract ||
    !vk.NonFungibleTokenAdvancedOfferContract.hash ||
    !vk.NonFungibleTokenAdvancedOfferContract.data
  )
    throw new Error("Cannot get verification key from vk");

  if (txType === "nft:sell" || txType === "nft:buy") {
    verificationKeyHashes.push(vk.NonFungibleTokenOfferContract.hash);
  }

  // const offerVerificationKey = FungibleTokenOfferContract._verificationKey ?? {
  //   hash: Field(vk.FungibleTokenOfferContract.hash),
  //   data: vk.FungibleTokenOfferContract.data,
  // };
  // const bidVerificationKey = FungibleTokenBidContract._verificationKey ?? {
  //   hash: Field(vk.FungibleTokenBidContract.hash),
  //   data: vk.FungibleTokenBidContract.data,
  // };

  // const isNewBidOfferAccount =
  //   txType === "token:offer:create" && offerAddress
  //     ? !Mina.hasAccount(offerAddress, tokenId)
  //     : txType === "token:bid:create" && bidAddress
  //     ? !Mina.hasAccount(bidAddress)
  //     : false;

  // const isNewBuyAccount =
  //   txType === "token:offer:buy" ? !Mina.hasAccount(sender, tokenId) : false;
  // let isNewSellAccount: boolean = false;
  // if (txType === "token:bid:sell") {
  //   if (!bidAddress || !bidContract) throw new Error("Bid address is required");
  //   await fetchMinaAccount({
  //     publicKey: bidAddress,
  //     force: true,
  //   });
  //   const buyer = bidContract.buyer.get();
  //   await fetchMinaAccount({
  //     publicKey: buyer,
  //     tokenId,
  //     force: false,
  //   });
  //   isNewSellAccount = !Mina.hasAccount(buyer, tokenId);
  // }

  // if (txType === "token:burn") {
  //   await fetchMinaAccount({
  //     publicKey: sender,
  //     force: true,
  //   });
  //   await fetchMinaAccount({
  //     publicKey: sender,
  //     tokenId,
  //     force: false,
  //   });
  //   if (!Mina.hasAccount(sender, tokenId))
  //     throw new Error("Sender does not have tokens to burn");
  // }

  // const isNewTransferMintAccount =
  //   (txType === "token:transfer" ||
  //     txType === "token:airdrop" ||
  //     txType === "token:mint") &&
  //   to
  //     ? !Mina.hasAccount(to, tokenId)
  //     : false;

  // const accountCreationFee =
  //   (isNewBidOfferAccount ? 1_000_000_000 : 0) +
  //   (isNewBuyAccount ? 1_000_000_000 : 0) +
  //   (isNewSellAccount ? 1_000_000_000 : 0) +
  //   (isNewTransferMintAccount ? 1_000_000_000 : 0) +
  //   (isToNewAccount &&
  //   txType === "token:mint" &&
  //   adminType === "advanced" &&
  //   advancedAdminContract.whitelist.get().isSome().toBoolean()
  //     ? 1_000_000_000
  //     : 0);
  // console.log("accountCreationFee", accountCreationFee / 1_000_000_000);

  // switch (txType) {
  //   case "token:offer:buy":
  //   case "token:offer:withdraw":
  //   case "token:offer:whitelist":
  //     if (offerContract === undefined)
  //       throw new Error("Offer contract is required");
  //     if (
  //       Mina.getAccount(
  //         offerContract.address,
  //         tokenId
  //       ).zkapp?.verificationKey?.hash.toJSON() !==
  //       vk.FungibleTokenOfferContract.hash
  //     )
  //       throw new Error(
  //         "Invalid offer verification key, offer contract has to be upgraded"
  //       );
  //     break;
  // }
  // switch (txType) {
  //   case "token:bid:sell":
  //   case "token:bid:withdraw":
  //   case "token:bid:whitelist":
  //     if (bidContract === undefined)
  //       throw new Error("Bid contract is required");
  //     if (
  //       Mina.getAccount(
  //         bidContract.address
  //       ).zkapp?.verificationKey?.hash.toJSON() !==
  //       vk.FungibleTokenBidContract.hash
  //     )
  //       throw new Error(
  //         "Invalid bid verification key, bid contract has to be upgraded"
  //       );
  //     break;
  // }

  // switch (txType) {
  //   case "token:mint":
  //   case "token:burn":
  //   case "token:redeem":
  //   case "token:transfer":
  //   case "token:airdrop":
  //   case "token:offer:create":
  //   case "token:bid:create":
  //   case "token:offer:buy":
  //   case "token:offer:withdraw":
  //   case "token:bid:sell":
  //     if (
  //       Mina.getAccount(
  //         zkToken.address
  //       ).zkapp?.verificationKey?.hash.toJSON() !== vk.FungibleToken.hash
  //     )
  //       throw new Error(
  //         "Invalid token verification key, token contract has to be upgraded"
  //       );
  //     break;
  // }

  const accountCreationFee = txType === "nft:sell" ? ACCOUNT_CREATION_FEE : 0n;
  const zkOffer = offerAddress ? new Offer(offerAddress) : undefined;

  const tx = await Mina.transaction({ sender, fee, memo, nonce }, async () => {
    if (txType !== "nft:buy") {
      const feeAccountUpdate = AccountUpdate.createSigned(sender);
      if (accountCreationFee > 0) {
        feeAccountUpdate.balance.subInPlace(accountCreationFee);
      }
      if (provingKey && provingFee)
        feeAccountUpdate.send({
          to: provingKey,
          amount: provingFee,
        });
      if (developerAddress && developerFee) {
        feeAccountUpdate.send({
          to: developerAddress,
          amount: developerFee,
        });
      }
    }

    switch (txType) {
      case "nft:transfer":
        if (!from || !to)
          throw new Error("From and to are required for nft:transfer");
        const context = args.nftTransferParams?.context?.custom
          ? new NFTTransactionContext({
              custom: args.nftTransferParams.context.custom.map((x) =>
                Field.fromJSON(x)
              ),
            })
          : new NFTTransactionContext({
              custom: [Field(0), Field(0), Field(0)],
            });

        const transferParams: TransferBySignatureParams = {
          address: nftAddress,
          to,
          price: price ? UInt64Option.from(price) : UInt64Option.none(),
          context,
        };
        if (args.nftTransferParams.requireApproval === true)
          await zkCollection.adminApprovedTransferBySignature(transferParams);
        else await zkCollection.transferBySignature(transferParams);
        break;

      case "nft:approve":
        if (!to) throw new Error("To address is required for nft:approve");

        await zkCollection.approveAddress(nftAddress, to);
        break;

      case "nft:sell":
        if (!price) throw new Error("Price is required for nft:sell");
        if (!offerAddress)
          throw new Error("Offer address is required for nft:sell");
        if (zkOffer === undefined)
          throw new Error("Offer contract is required for nft:sell");

        await zkCollection.approveAddress(nftAddress, offerAddress);
        await zkOffer.deploy({
          verificationKey: vk.NonFungibleTokenOfferContract,
          collection: zkCollection.address,
          nft: nftAddress,
          owner: sender,
          price,
        });
        break;

      case "nft:buy":
        if (!offerAddress)
          throw new Error("Offer address is required for nft:buy");
        if (zkOffer === undefined)
          throw new Error("Offer contract is required for nft:buy");
        if (!buyer) throw new Error("Buyer is required for nft:buy");
        await zkOffer.buy(buyer);
        break;

      default:
        throw new Error(`Unknown transaction type: ${txType}`);
    }
  });
  return {
    request: args,
    tx,
    adminType,
    adminContractAddress,
    symbol,
    collectionName,
    nftName,
    verificationKeyHashes,
    metadataRoot,
    privateMetadata: undefined,
    storage,
    map: undefined,
  };
}

export async function buildNftMintTransaction(params: {
  chain: blockchain;
  args: NftMintTransactionParams;
  developerAddress?: string;
  provingKey?: string;
  provingFee?: number;
}): Promise<{
  request: NftMintTransactionParams;
  tx: Transaction<false, false>;
  adminType: NftAdminType;
  adminContractAddress: PublicKey;
  symbol: string;
  collectionName: string;
  nftName: string;
  verificationKeyHashes: string[];
  metadataRoot: string;
  storage: string;
  privateMetadata?: string;
  map?: IndexedMapSerialized;
}> {
  const { chain, args } = params;
  const ACCOUNT_CREATION_FEE: bigint =
    chain === "zeko" ? 100_000_000n : 1_000_000_000n;
  const { nonce, txType } = args;
  if (nonce === undefined) throw new Error("Nonce is required");
  if (typeof nonce !== "number") throw new Error("Nonce must be a number");
  if (txType === undefined) throw new Error("Tx type is required");
  if (typeof txType !== "string") throw new Error("Tx type must be a string");
  const sender = PublicKey.fromBase58(args.sender);
  const collectionAddress = PublicKey.fromBase58(args.collectionAddress);
  if (args?.nftMintParams?.address === undefined) {
    throw new Error("NFT address is required");
  }
  if (args?.nftMintParams?.data?.owner === undefined) {
    throw new Error("NFT owner is required");
  }
  const nftAddress = PublicKey.fromBase58(args.nftMintParams.address);

  await fetchMinaAccount({
    publicKey: sender,
    force: true,
  });

  if (!Mina.hasAccount(sender)) {
    throw new Error("Sender does not have account");
  }

  const {
    symbol,
    adminContractAddress,
    adminType,
    verificationKeyHashes,
    collectionName,
  } = await getNftSymbolAndAdmin({
    txType,
    collectionAddress,
    chain,
    nftAddress: undefined, // TODO: add nft address
  });
  const nftName = args.nftMintParams.name;
  const memo = args.memo ?? `${txType.split(":")[1]} ${symbol} ${nftName}`;
  const fee = args.fee ?? 200_000_000;
  const provingKey = params.provingKey
    ? PublicKey.fromBase58(params.provingKey)
    : sender;
  const provingFee = params.provingFee
    ? UInt64.from(Math.round(params.provingFee))
    : undefined;
  const developerFee = args.developerFee
    ? UInt64.from(Math.round(args.developerFee))
    : undefined;
  const developerAddress = params.developerAddress
    ? PublicKey.fromBase58(params.developerAddress)
    : undefined;

  const advancedAdminContract = new NFTAdvancedAdmin(adminContractAddress);
  const adminContract = new NFTAdmin(adminContractAddress);
  const collectionContract =
    adminType === "advanced" ? AdvancedCollection : Collection;

  const zkCollection = new collectionContract(collectionAddress);
  const tokenId = zkCollection.deriveTokenId();

  await fetchMinaAccount({
    publicKey: nftAddress,
    tokenId,
    force: (
      ["nft:transfer"] satisfies NftTransactionType[] as NftTransactionType[]
    ).includes(txType),
  });

  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  if (
    !vk ||
    !vk.Collection ||
    !vk.Collection.hash ||
    !vk.Collection.data ||
    !vk.AdvancedCollection ||
    !vk.AdvancedCollection.hash ||
    !vk.AdvancedCollection.data ||
    !vk.NFT ||
    !vk.NFT.hash ||
    !vk.NFT.data ||
    !vk.NFTAdmin ||
    !vk.NFTAdmin.hash ||
    !vk.NFTAdmin.data ||
    !vk.NFTAdvancedAdmin ||
    !vk.NFTAdvancedAdmin.hash ||
    !vk.NFTAdvancedAdmin.data
  )
    throw new Error("Cannot get verification key from vk");

  const { name, ipfsHash, metadataRoot, privateMetadata, serializedMap } =
    typeof args.nftMintParams.metadata === "string"
      ? {
          name: args.nftMintParams.name,
          ipfsHash: args.nftMintParams.storage,
          metadataRoot: Field.fromJSON(args.nftMintParams.metadata),
          privateMetadata: undefined,
          serializedMap: undefined,
        }
      : await pinMetadata(
          Metadata.fromOpenApiJSON({ json: args.nftMintParams.metadata })
        );

  if (ipfsHash === undefined)
    throw new Error("storage is required, but not provided");
  if (metadataRoot === undefined) throw new Error("metadataRoot is required");

  const slot =
    chain === "local"
      ? Mina.currentSlot()
      : chain === "zeko"
      ? UInt32.from((await getCurrentZekoSlot("zeko")) ?? 2_000_000)
      : (await fetchLastBlock()).globalSlotSinceGenesis;
  const expiry = slot.add(UInt32.from(100));
  if (chain === "zeko") {
    console.log("zeko slot", slot.toBigint());
    console.log("zeko expiry", expiry.toBigint());
  }

  const nftDataArgs = args.nftMintParams.data;
  if (nftDataArgs.owner === undefined) {
    throw new Error("NFT owner is required");
  }
  const nftData = NFTData.new({ ...nftDataArgs, owner: nftDataArgs.owner });

  if (!args.nftMintParams.address) throw new Error("NFT address is required");

  const mintParams = new MintParams({
    name: fieldFromString(name),
    address: PublicKey.fromBase58(args.nftMintParams.address),
    tokenId: TokenId.derive(collectionAddress),
    data: nftData,
    fee: args.nftMintParams.fee
      ? UInt64.from(Math.round(args.nftMintParams.fee * 1_000_000_000))
      : UInt64.zero,
    metadata: metadataRoot,
    storage: Storage.fromString(ipfsHash),
    metadataVerificationKeyHash: args.nftMintParams.metadataVerificationKeyHash
      ? Field.fromJSON(args.nftMintParams.metadataVerificationKeyHash)
      : Field(0),
    expiry: args.nftMintParams.expiry
      ? UInt32.from(Math.round(args.nftMintParams.expiry))
      : expiry,
  });

  const tx = await Mina.transaction({ sender, fee, memo, nonce }, async () => {
    const feeAccountUpdate = AccountUpdate.createSigned(sender);
    if (ACCOUNT_CREATION_FEE < 1_000_000_000n) {
      feeAccountUpdate.balance.addInPlace(
        1_000_000_000n - ACCOUNT_CREATION_FEE
      );
    }
    if (provingKey && provingFee)
      feeAccountUpdate.send({
        to: provingKey,
        amount: provingFee,
      });
    if (developerAddress && developerFee) {
      feeAccountUpdate.send({
        to: developerAddress,
        amount: developerFee,
      });
    }

    switch (txType) {
      case "nft:mint":
        await zkCollection.mintByCreator(mintParams);
        break;

      default:
        throw new Error(`Unknown transaction type: ${txType}`);
    }
  });
  return {
    request: args,
    tx,
    adminType,
    adminContractAddress,
    symbol,
    collectionName,
    nftName,
    verificationKeyHashes,
    metadataRoot: metadataRoot.toJSON(),
    privateMetadata,
    storage: ipfsHash,
    map: serializedMap,
  };
}

export async function getNftSymbolAndAdmin(params: {
  txType: NftTransactionType;
  // to?: PublicKey;
  // offerAddress?: PublicKey;
  // bidAddress?: PublicKey;
  nftAddress?: PublicKey;
  collectionAddress: PublicKey;
  chain: blockchain;
}): Promise<{
  adminContractAddress: PublicKey;
  symbol: string;
  collectionName: string;
  adminType: NftAdminType;
  verificationKeyHashes: string[];
  nftName?: string;
  storage?: string;
  approved?: PublicKey;
  metadataRoot?: string;
}> {
  const { txType, collectionAddress, chain, nftAddress } = params;
  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  let verificationKeyHashes: string[] = [];
  let nftName: string | undefined = undefined;
  let storage: string | undefined = undefined;
  let metadataRoot: string | undefined = undefined;
  let approved: PublicKey | undefined = undefined;
  // if (bidAddress) {
  //   verificationKeyHashes.push(vk.FungibleTokenBidContract.hash);
  // }
  // if (offerAddress) {
  //   verificationKeyHashes.push(vk.FungibleTokenOfferContract.hash);
  // }

  await fetchMinaAccount({ publicKey: collectionAddress, force: true });
  if (!Mina.hasAccount(collectionAddress)) {
    throw new Error("Collection contract account not found");
  }
  const tokenId = TokenId.derive(collectionAddress);
  if (nftAddress) {
    await fetchMinaAccount({
      publicKey: nftAddress,
      tokenId,
      force: true,
    });
    if (!Mina.hasAccount(nftAddress, tokenId)) {
      throw new Error("NFT account not found");
    }
    const nftAccount = Mina.getAccount(nftAddress, tokenId);
    const verificationKey = nftAccount.zkapp?.verificationKey;
    if (!verificationKey) {
      throw new Error("NFT contract verification key not found");
    }
    if (!verificationKeyHashes.includes(verificationKey.hash.toJSON())) {
      verificationKeyHashes.push(verificationKey.hash.toJSON());
    }
    if (nftAccount.zkapp?.appState === undefined) {
      throw new Error("NFT contract state not found");
    }
    const nft = new NFT(nftAddress, tokenId);
    nftName = fieldToString(nft.name.get());
    storage = nft.storage.get().toString();
    metadataRoot = nft.metadata.get().toJSON();
    const data = NFTData.unpack(nft.packedData.get());
    approved = data.approved;
  }

  const account = Mina.getAccount(collectionAddress);
  const verificationKey = account.zkapp?.verificationKey;
  if (!verificationKey) {
    throw new Error("Collection contract verification key not found");
  }
  if (!verificationKeyHashes.includes(verificationKey.hash.toJSON())) {
    verificationKeyHashes.push(verificationKey.hash.toJSON());
  }
  if (account.zkapp?.appState === undefined) {
    throw new Error("Collection contract state not found");
  }

  const collection = new Collection(collectionAddress);
  const symbol = account.tokenSymbol;
  const collectionName = fieldToString(collection.collectionName.get());
  const adminContractPublicKey = collection.admin.get();
  await fetchMinaAccount({
    publicKey: adminContractPublicKey,
    force: true,
  });
  if (!Mina.hasAccount(adminContractPublicKey)) {
    throw new Error("Admin contract account not found");
  }

  const adminContract = Mina.getAccount(adminContractPublicKey);
  const adminVerificationKey = adminContract.zkapp?.verificationKey;

  if (!adminVerificationKey) {
    throw new Error("Admin verification key not found");
  }
  if (!verificationKeyHashes.includes(adminVerificationKey.hash.toJSON())) {
    verificationKeyHashes.push(adminVerificationKey.hash.toJSON());
  }
  let adminType: NftAdminType = "unknown";
  if (
    vk.NFTAdvancedAdmin.hash === adminVerificationKey.hash.toJSON() &&
    vk.NFTAdvancedAdmin.data === adminVerificationKey.data
  ) {
    adminType = "advanced";
  } else if (
    vk.NFTAdmin.hash === adminVerificationKey.hash.toJSON() &&
    vk.NFTAdmin.data === adminVerificationKey.data
  ) {
    adminType = "standard";
  } else {
    console.error("Unknown admin verification key", {
      hash: adminVerificationKey.hash.toJSON(),
      symbol,
      address: adminContractPublicKey.toBase58(),
    });
  }
  // let isToNewAccount: boolean | undefined = undefined;
  // if (to) {
  //   if (adminType === "advanced") {
  //     const adminTokenId = TokenId.derive(adminContractPublicKey);
  //     await fetchMinaAccount({
  //       publicKey: to,
  //       tokenId: adminTokenId,
  //       force: false,
  //     });
  //     isToNewAccount = !Mina.hasAccount(to, adminTokenId);
  //   }
  //   if (adminType === "bondingCurve") {
  //     const adminTokenId = TokenId.derive(adminContractPublicKey);
  //     await fetchMinaAccount({
  //       publicKey: adminContractPublicKey,
  //       tokenId: adminTokenId,
  //       force: true,
  //     });
  //   }
  // }
  // const adminAddress0 = adminContract.zkapp?.appState[0];
  // const adminAddress1 = adminContract.zkapp?.appState[1];
  // if (adminAddress0 === undefined || adminAddress1 === undefined) {
  //   throw new Error("Cannot fetch admin address from admin contract");
  // }
  // const adminAddress = PublicKey.fromFields([adminAddress0, adminAddress1]);

  for (const hash of verificationKeyHashes) {
    const found = Object.values(vk).some((key) => key.hash === hash);
    if (!found) {
      console.error(`Final check: unknown verification key hash: ${hash}`);
      verificationKeyHashes = verificationKeyHashes.filter((h) => h !== hash);
    }
  }

  // Sort verification key hashes by type
  verificationKeyHashes.sort((a, b) => {
    const typeA = Object.values(vk).find((key) => key.hash === a)?.type;
    const typeB = Object.values(vk).find((key) => key.hash === b)?.type;
    if (typeA === undefined || typeB === undefined) {
      throw new Error("Unknown verification key hash");
    }
    const typeOrder = {
      upgrade: 0,
      nft: 1,
      admin: 2,
      collection: 3,
      token: 4,
      user: 5,
    };

    return typeOrder[typeA] - typeOrder[typeB];
  });

  return {
    adminContractAddress: adminContractPublicKey,
    symbol,
    collectionName,
    adminType,
    verificationKeyHashes,
    nftName,
    storage,
    metadataRoot,
    approved,
  };
}
