import {
  Whitelist,
  WhitelistedAddress,
  Storage,
  pinJSON,
  serializeIndexedMap,
  IndexedMapSerialized,
} from "@silvana-one/storage";
import {
  NftTransactionType,
  NftTransactionParams,
  LaunchNftCollectionStandardAdminParams,
  LaunchNftCollectionAdvancedAdminParams,
  NftMintTransactionParams,
} from "@silvana-one/api";
import { blockchain } from "../types.js";
import { fetchMinaAccount } from "../fetch.js";
import {
  Collection,
  Admin,
  NFT,
  AdvancedCollection,
  AdvancedAdmin,
  Metadata,
  pinMetadata,
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
  name: string;
  verificationKeyHashes: string[];
  metadataHash: string;
  storage: string;
  privateMetadata?: string;
  map?: IndexedMapSerialized;
}> {
  const { chain, args } = params;
  const {
    url,
    symbol,
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
  const fee = 100_000_000;
  if (url && typeof url !== "string") throw new Error("Url must be a string");
  if (!args.collectionAddress || typeof args.collectionAddress !== "string")
    throw new Error("collectionAddress is required");
  if (
    !args.adminContractAddress ||
    typeof args.adminContractAddress !== "string"
  )
    throw new Error("adminContractAddress is required");

  const adminContract = adminType === "advanced" ? AdvancedAdmin : Admin;
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
    adminType === "advanced" ? vk.NFTAdvancedCollection : vk.NFTCollection;

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
  const zkCollection = new collectionContract(collectionAddress);
  const zkAdmin = new adminContract(adminContractAddress);

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

  let metadataHash: Field =
    typeof masterNFT.metadata === "string"
      ? Field.fromJSON(masterNFT.metadata)
      : Field(0);

  const { name, ipfsHash, metadataRoot, privateMetadata, serializedMap } =
    await pinMetadata(masterNFT.metadata);

  const tx = await Mina.transaction(
    {
      sender,
      fee,
      memo: memo ?? `NFT collection ${args.collectionName} launch`.slice(30),
      nonce,
    },
    async () => {
      if (zkAdmin instanceof AdvancedAdmin) {
        console.log("deploying bonding curve admin", {
          verificationKey: adminVerificationKey.hash,
          tokenAddress: tokenAddress.toBase58(),
          feeMaster: provingKey.toBase58(),
          adminContractAddress: adminContractAddress.toBase58(),
        });
        await zkAdmin.deploy({
          verificationKey: adminVerificationKey,
        });
        zkAdmin.account.tokenSymbol.set("BC");
        zkAdmin.account.zkappUri.set(uri);
        await zkAdmin.initialize({
          tokenAddress,
          startPrice: UInt64.from(10_000),
          curveK: UInt64.from(10_000),
          feeMaster: provingKey,
          fee: UInt32.from(1000), // 1000 = 1%
          launchFee: UInt64.from(10_000_000_000),
          numberOfNewAccounts: UInt64.from(4),
        });
      } else {
        const feeAccountUpdate = AccountUpdate.createSigned(sender);
        feeAccountUpdate.balance.subInPlace(
          3_000_000_000 + (adminType === "advanced" ? 1_000_000_000 : 0)
        );

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

        await zkAdmin.deploy({
          adminPublicKey: sender,
          tokenContract: tokenAddress,
          verificationKey: adminVerificationKey,
          whitelist,
          totalSupply,
          requireAdminSignatureForMint,
          anyoneCanMint,
        });
        if (adminType === "advanced") {
          const adminUpdate = AccountUpdate.create(
            adminContractAddress,
            TokenId.derive(adminContractAddress)
          );
          zkAdmin.approve(adminUpdate);
        }
        zkAdmin.account.zkappUri.set(uri);
      }

      await zkToken.deploy({
        symbol,
        src: uri,
        verificationKey: tokenVerificationKey,
        allowUpdates: true,
      });
      await zkToken.initialize(
        adminContractAddress,
        decimals,
        // We can set `startPaused` to `Bool(false)` here, because we are doing an atomic deployment
        // If you are not deploying the admin and token contracts in the same transaction,
        // it is safer to start the tokens paused, and resume them only after verifying that
        // the admin contract has been deployed
        Bool(false)
      );
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
    verificationKeyHashes: [
      adminVerificationKey.hash,
      tokenVerificationKey.hash,
    ],
  };
}

export async function buildTokenTransaction(params: {
  chain: blockchain;
  args: Exclude<
    TokenTransactionParams,
    | LaunchTokenStandardAdminParams
    | LaunchTokenAdvancedAdminParams
    | LaunchTokenBondingCurveAdminParams
  >;
  developerAddress?: string;
  provingKey?: string;
  provingFee?: number;
}): Promise<{
  request: Exclude<
    TokenTransactionParams,
    | LaunchTokenStandardAdminParams
    | LaunchTokenAdvancedAdminParams
    | LaunchTokenBondingCurveAdminParams
  >;
  tx: Transaction<false, false>;
  adminType: AdminType;
  adminContractAddress: PublicKey;
  adminAddress: PublicKey;
  symbol: string;
  verificationKeyHashes: string[];
}> {
  const { chain, args } = params;
  const { nonce, txType } = args;
  if (nonce === undefined) throw new Error("Nonce is required");
  if (typeof nonce !== "number") throw new Error("Nonce must be a number");
  if (txType === undefined) throw new Error("Tx type is required");
  if (typeof txType !== "string") throw new Error("Tx type must be a string");
  const sender = PublicKey.fromBase58(args.sender);
  const tokenAddress = PublicKey.fromBase58(args.tokenAddress);
  const offerAddress =
    "offerAddress" in args && args.offerAddress
      ? PublicKey.fromBase58(args.offerAddress)
      : undefined;
  if (
    !offerAddress &&
    (txType === "token:offer:create" ||
      txType === "token:offer:buy" ||
      txType === "token:offer:withdraw")
  )
    throw new Error("Offer address is required");

  const bidAddress =
    "bidAddress" in args && args.bidAddress
      ? PublicKey.fromBase58(args.bidAddress)
      : undefined;
  if (
    !bidAddress &&
    (txType === "token:bid:create" ||
      txType === "token:bid:sell" ||
      txType === "token:bid:withdraw")
  )
    throw new Error("Bid address is required");

  const to =
    "to" in args && args.to ? PublicKey.fromBase58(args.to) : undefined;
  if (
    !to &&
    (txType === "token:transfer" ||
      txType === "token:airdrop" ||
      txType === "token:mint")
  )
    throw new Error("To address is required");

  const from =
    "from" in args && args.from ? PublicKey.fromBase58(args.from) : undefined;
  if (!from && txType === "token:burn")
    throw new Error("From address is required for token:burn");

  const amount =
    "amount" in args ? UInt64.from(Math.round(args.amount)) : undefined;
  const price =
    "price" in args && args.price
      ? UInt64.from(Math.round(args.price))
      : undefined;
  const slippage = UInt32.from(
    Math.round(
      "slippage" in args && args.slippage !== undefined ? args.slippage : 50
    )
  );

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
    adminAddress,
    adminType,
    isToNewAccount,
    verificationKeyHashes,
  } = await getTokenSymbolAndAdmin({
    txType,
    tokenAddress,
    chain,
    to,
    offerAddress,
    bidAddress,
  });
  const memo = args.memo ?? `${txType} ${symbol}`;
  const fee = 100_000_000;
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
  const advancedAdminContract = new FungibleTokenAdvancedAdmin(
    adminContractAddress
  );
  const bondingCurveAdminContract = new FungibleTokenBondingCurveAdmin(
    adminContractAddress
  );
  const tokenContract =
    adminType === "advanced" && txType === "token:mint"
      ? AdvancedFungibleToken
      : adminType === "bondingCurve" &&
        (txType === "token:mint" || txType === "token:redeem")
      ? BondingCurveFungibleToken
      : FungibleToken;

  if (
    (txType === "token:admin:whitelist" ||
      txType === "token:bid:whitelist" ||
      txType === "token:offer:whitelist") &&
    !args.whitelist
  ) {
    throw new Error("Whitelist is required");
  }

  const whitelist =
    "whitelist" in args && args.whitelist
      ? typeof args.whitelist === "string"
        ? Whitelist.fromString(args.whitelist)
        : (await Whitelist.create({ list: args.whitelist, name: symbol }))
            .whitelist
      : Whitelist.empty();

  const zkToken = new tokenContract(tokenAddress);
  const tokenId = zkToken.deriveTokenId();

  if (
    txType === "token:mint" &&
    adminType === "standard" &&
    adminAddress.toBase58() !== sender.toBase58()
  )
    throw new Error(
      "Invalid sender for FungibleToken mint with standard admin"
    );

  await fetchMinaAccount({
    publicKey: sender,
    tokenId,
    force: (
      [
        "token:transfer",
        "token:airdrop",
      ] satisfies TokenTransactionType[] as TokenTransactionType[]
    ).includes(txType),
  });

  if (to) {
    await fetchMinaAccount({
      publicKey: to,
      tokenId,
      force: false,
    });
  }

  if (from) {
    await fetchMinaAccount({
      publicKey: from,
      tokenId,
      force: false,
    });
  }

  if (offerAddress)
    await fetchMinaAccount({
      publicKey: offerAddress,
      tokenId,
      force: (
        [
          "token:offer:whitelist",
          "token:offer:buy",
          "token:offer:withdraw",
        ] satisfies TokenTransactionType[] as TokenTransactionType[]
      ).includes(txType),
    });
  if (bidAddress)
    await fetchMinaAccount({
      publicKey: bidAddress,
      force: (
        [
          "token:bid:whitelist",
          "token:bid:sell",
          "token:bid:withdraw",
        ] satisfies TokenTransactionType[] as TokenTransactionType[]
      ).includes(txType),
    });

  const offerContract = offerAddress
    ? new FungibleTokenOfferContract(offerAddress, tokenId)
    : undefined;

  const bidContract = bidAddress
    ? new FungibleTokenBidContract(bidAddress)
    : undefined;
  const offerContractDeployment = offerAddress
    ? new FungibleTokenOfferContract(offerAddress, tokenId)
    : undefined;
  const bidContractDeployment = bidAddress
    ? new FungibleTokenBidContract(bidAddress)
    : undefined;
  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  if (
    !vk ||
    !vk.FungibleTokenOfferContract ||
    !vk.FungibleTokenOfferContract.hash ||
    !vk.FungibleTokenOfferContract.data ||
    !vk.FungibleTokenBidContract ||
    !vk.FungibleTokenBidContract.hash ||
    !vk.FungibleTokenBidContract.data ||
    !vk.FungibleTokenAdvancedAdmin ||
    !vk.FungibleTokenAdvancedAdmin.hash ||
    !vk.FungibleTokenAdvancedAdmin.data ||
    !vk.FungibleTokenBondingCurveAdmin ||
    !vk.FungibleTokenBondingCurveAdmin.hash ||
    !vk.FungibleTokenBondingCurveAdmin.data ||
    !vk.FungibleTokenAdmin ||
    !vk.FungibleTokenAdmin.hash ||
    !vk.FungibleTokenAdmin.data ||
    !vk.AdvancedFungibleToken ||
    !vk.AdvancedFungibleToken.hash ||
    !vk.AdvancedFungibleToken.data ||
    !vk.FungibleToken ||
    !vk.FungibleToken.hash ||
    !vk.FungibleToken.data
  )
    throw new Error("Cannot get verification key from vk");

  const offerVerificationKey = FungibleTokenOfferContract._verificationKey ?? {
    hash: Field(vk.FungibleTokenOfferContract.hash),
    data: vk.FungibleTokenOfferContract.data,
  };
  const bidVerificationKey = FungibleTokenBidContract._verificationKey ?? {
    hash: Field(vk.FungibleTokenBidContract.hash),
    data: vk.FungibleTokenBidContract.data,
  };

  const isNewBidOfferAccount =
    txType === "token:offer:create" && offerAddress
      ? !Mina.hasAccount(offerAddress, tokenId)
      : txType === "token:bid:create" && bidAddress
      ? !Mina.hasAccount(bidAddress)
      : false;

  const isNewBuyAccount =
    txType === "token:offer:buy" ? !Mina.hasAccount(sender, tokenId) : false;
  let isNewSellAccount: boolean = false;
  if (txType === "token:bid:sell") {
    if (!bidAddress || !bidContract) throw new Error("Bid address is required");
    await fetchMinaAccount({
      publicKey: bidAddress,
      force: true,
    });
    const buyer = bidContract.buyer.get();
    await fetchMinaAccount({
      publicKey: buyer,
      tokenId,
      force: false,
    });
    isNewSellAccount = !Mina.hasAccount(buyer, tokenId);
  }

  if (txType === "token:burn") {
    await fetchMinaAccount({
      publicKey: sender,
      force: true,
    });
    await fetchMinaAccount({
      publicKey: sender,
      tokenId,
      force: false,
    });
    if (!Mina.hasAccount(sender, tokenId))
      throw new Error("Sender does not have tokens to burn");
  }

  const isNewTransferMintAccount =
    (txType === "token:transfer" ||
      txType === "token:airdrop" ||
      txType === "token:mint") &&
    to
      ? !Mina.hasAccount(to, tokenId)
      : false;

  const accountCreationFee =
    (isNewBidOfferAccount ? 1_000_000_000 : 0) +
    (isNewBuyAccount ? 1_000_000_000 : 0) +
    (isNewSellAccount ? 1_000_000_000 : 0) +
    (isNewTransferMintAccount ? 1_000_000_000 : 0) +
    (isToNewAccount &&
    txType === "token:mint" &&
    adminType === "advanced" &&
    advancedAdminContract.whitelist.get().isSome().toBoolean()
      ? 1_000_000_000
      : 0);
  console.log("accountCreationFee", accountCreationFee / 1_000_000_000);

  switch (txType) {
    case "token:offer:buy":
    case "token:offer:withdraw":
    case "token:offer:whitelist":
      if (offerContract === undefined)
        throw new Error("Offer contract is required");
      if (
        Mina.getAccount(
          offerContract.address,
          tokenId
        ).zkapp?.verificationKey?.hash.toJSON() !==
        vk.FungibleTokenOfferContract.hash
      )
        throw new Error(
          "Invalid offer verification key, offer contract has to be upgraded"
        );
      break;
  }
  switch (txType) {
    case "token:bid:sell":
    case "token:bid:withdraw":
    case "token:bid:whitelist":
      if (bidContract === undefined)
        throw new Error("Bid contract is required");
      if (
        Mina.getAccount(
          bidContract.address
        ).zkapp?.verificationKey?.hash.toJSON() !==
        vk.FungibleTokenBidContract.hash
      )
        throw new Error(
          "Invalid bid verification key, bid contract has to be upgraded"
        );
      break;
  }

  switch (txType) {
    case "token:mint":
    case "token:burn":
    case "token:redeem":
    case "token:transfer":
    case "token:airdrop":
    case "token:offer:create":
    case "token:bid:create":
    case "token:offer:buy":
    case "token:offer:withdraw":
    case "token:bid:sell":
      if (
        Mina.getAccount(
          zkToken.address
        ).zkapp?.verificationKey?.hash.toJSON() !== vk.FungibleToken.hash
      )
        throw new Error(
          "Invalid token verification key, token contract has to be upgraded"
        );
      break;
  }

  const tx = await Mina.transaction({ sender, fee, memo, nonce }, async () => {
    if (
      adminType !== "bondingCurve" ||
      (txType !== "token:mint" && txType !== "token:redeem")
    ) {
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
      case "token:mint":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (to === undefined) throw new Error("Error: To address is required");
        if (adminType === "bondingCurve") {
          if (price === undefined)
            throw new Error("Error: Price is required for bonding curve mint");
          await bondingCurveAdminContract.mint(to, amount, price);
        } else {
          await zkToken.mint(to, amount);
        }
        break;

      case "token:redeem":
        if (adminType !== "bondingCurve")
          throw new Error("Error: Invalid admin type for redeem");
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (price === undefined) throw new Error("Error: Price is required");
        if (slippage === undefined)
          throw new Error("Error: Slippage is required");

        await bondingCurveAdminContract.redeem(amount, price, slippage);

        break;

      case "token:transfer":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (to === undefined)
          throw new Error("Error: From address is required");
        await zkToken.transfer(sender, to, amount);
        break;

      case "token:burn":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (from === undefined)
          throw new Error("Error: From address is required");
        await zkToken.burn(from, amount);
        break;

      case "token:offer:create":
        if (price === undefined) throw new Error("Error: Price is required");
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (offerContract === undefined)
          throw new Error("Error: Offer address is required");
        if (offerContractDeployment === undefined)
          throw new Error("Error: Offer address is required");
        if (isNewBidOfferAccount) {
          await offerContractDeployment.deploy({
            verificationKey: offerVerificationKey,
            whitelist: whitelist ?? Whitelist.empty(),
          });
          offerContract.account.zkappUri.set(`Offer for ${symbol}`);
          await offerContract.initialize(sender, tokenAddress, amount, price);
          await zkToken.approveAccountUpdates([
            offerContractDeployment.self,
            offerContract.self,
          ]);
        } else {
          await offerContract.offer(amount, price);
          await zkToken.approveAccountUpdate(offerContract.self);
        }

        break;

      case "token:offer:buy":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (offerContract === undefined)
          throw new Error("Error: Offer address is required");
        await offerContract.buy(amount);
        await zkToken.approveAccountUpdate(offerContract.self);
        break;

      case "token:offer:withdraw":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (offerContract === undefined)
          throw new Error("Error: Offer address is required");
        await offerContract.withdraw(amount);
        await zkToken.approveAccountUpdate(offerContract.self);
        break;

      case "token:bid:create":
        if (price === undefined) throw new Error("Error: Price is required");
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (bidContract === undefined)
          throw new Error("Error: Bid address is required");
        if (bidContractDeployment === undefined)
          throw new Error("Error: Bid address is required");
        if (isNewBidOfferAccount) {
          await bidContractDeployment.deploy({
            verificationKey: bidVerificationKey,
            whitelist: whitelist ?? Whitelist.empty(),
          });
          bidContract.account.zkappUri.set(`Bid for ${symbol}`);
          await bidContract.initialize(tokenAddress, amount, price);
          await zkToken.approveAccountUpdates([
            bidContractDeployment.self,
            bidContract.self,
          ]);
        } else {
          await bidContract.bid(amount, price);
          await zkToken.approveAccountUpdate(bidContract.self);
        }
        break;

      case "token:bid:sell":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (bidContract === undefined)
          throw new Error("Error: Bid address is required");
        await bidContract.sell(amount);
        await zkToken.approveAccountUpdate(bidContract.self);
        break;

      case "token:bid:withdraw":
        if (amount === undefined) throw new Error("Error: Amount is required");
        if (bidContract === undefined)
          throw new Error("Error: Bid address is required");
        await bidContract.withdraw(amount);
        //await zkToken.approveAccountUpdate(bidContract.self);
        break;

      case "token:admin:whitelist":
        if (adminType !== "advanced")
          throw new Error("Invalid admin type for updateAdminWhitelist");
        await advancedAdminContract.updateWhitelist(whitelist);
        break;

      case "token:bid:whitelist":
        if (bidContract === undefined)
          throw new Error("Error: Bid address is required");
        await bidContract.updateWhitelist(whitelist);
        break;

      case "token:offer:whitelist":
        if (offerContract === undefined)
          throw new Error("Error: Offer address is required");
        await offerContract.updateWhitelist(whitelist);
        break;

      default:
        throw new Error(`Unknown transaction type: ${txType}`);
    }
  });
  return {
    request:
      txType === "token:offer:create" ||
      txType === "token:bid:create" ||
      txType === "token:offer:whitelist" ||
      txType === "token:bid:whitelist" ||
      txType === "token:admin:whitelist"
        ? {
            ...args,
            whitelist: whitelist?.toString(),
          }
        : args,
    tx,
    adminType,
    adminContractAddress,
    adminAddress,
    symbol,
    verificationKeyHashes,
  };
}

export async function getTokenSymbolAndAdmin(params: {
  txType: TokenTransactionType;
  to?: PublicKey;
  offerAddress?: PublicKey;
  bidAddress?: PublicKey;
  tokenAddress: PublicKey;
  chain: blockchain;
}): Promise<{
  adminContractAddress: PublicKey;
  adminAddress: PublicKey;
  symbol: string;
  adminType: AdminType;
  isToNewAccount?: boolean;
  verificationKeyHashes: string[];
}> {
  const { txType, tokenAddress, chain, to, offerAddress, bidAddress } = params;
  const vk =
    tokenVerificationKeys[chain === "mainnet" ? "mainnet" : "devnet"].vk;
  let verificationKeyHashes: string[] = [];
  if (bidAddress) {
    verificationKeyHashes.push(vk.FungibleTokenBidContract.hash);
  }
  if (offerAddress) {
    verificationKeyHashes.push(vk.FungibleTokenOfferContract.hash);
  }

  class FungibleTokenState extends Struct({
    decimals: UInt8,
    admin: PublicKey,
    paused: Bool,
  }) {}
  const FungibleTokenStateSize = FungibleTokenState.sizeInFields();
  class FungibleTokenAdminState extends Struct({
    adminPublicKey: PublicKey,
  }) {}
  const FungibleTokenAdminStateSize = FungibleTokenAdminState.sizeInFields();

  await fetchMinaAccount({ publicKey: tokenAddress, force: true });
  if (!Mina.hasAccount(tokenAddress)) {
    throw new Error("Token contract account not found");
  }
  const tokenId = TokenId.derive(tokenAddress);
  await fetchMinaAccount({ publicKey: tokenAddress, tokenId, force: true });
  if (!Mina.hasAccount(tokenAddress, tokenId)) {
    throw new Error("Token contract totalSupply account not found");
  }

  const account = Mina.getAccount(tokenAddress);
  const verificationKey = account.zkapp?.verificationKey;
  if (!verificationKey) {
    throw new Error("Token contract verification key not found");
  }
  if (!verificationKeyHashes.includes(verificationKey.hash.toJSON())) {
    verificationKeyHashes.push(verificationKey.hash.toJSON());
  }
  if (account.zkapp?.appState === undefined) {
    throw new Error("Token contract state not found");
  }

  const state = FungibleTokenState.fromFields(
    account.zkapp?.appState.slice(0, FungibleTokenStateSize)
  );
  const symbol = account.tokenSymbol;
  const adminContractPublicKey = state.admin;
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
  let adminType: AdminType = "unknown";
  if (
    vk.FungibleTokenAdvancedAdmin.hash === adminVerificationKey.hash.toJSON() &&
    vk.FungibleTokenAdvancedAdmin.data === adminVerificationKey.data
  ) {
    adminType = "advanced";
  } else if (
    vk.FungibleTokenAdmin.hash === adminVerificationKey.hash.toJSON() &&
    vk.FungibleTokenAdmin.data === adminVerificationKey.data
  ) {
    adminType = "standard";
  } else if (
    vk.FungibleTokenBondingCurveAdmin.hash ===
      adminVerificationKey.hash.toJSON() &&
    vk.FungibleTokenBondingCurveAdmin.data === adminVerificationKey.data
  ) {
    adminType = "bondingCurve";
  } else {
    console.error("Unknown admin verification key", {
      hash: adminVerificationKey.hash.toJSON(),
      symbol,
      address: adminContractPublicKey.toBase58(),
    });
  }
  let isToNewAccount: boolean | undefined = undefined;
  if (to) {
    if (adminType === "advanced") {
      const adminTokenId = TokenId.derive(adminContractPublicKey);
      await fetchMinaAccount({
        publicKey: to,
        tokenId: adminTokenId,
        force: false,
      });
      isToNewAccount = !Mina.hasAccount(to, adminTokenId);
    }
    if (adminType === "bondingCurve") {
      const adminTokenId = TokenId.derive(adminContractPublicKey);
      await fetchMinaAccount({
        publicKey: adminContractPublicKey,
        tokenId: adminTokenId,
        force: true,
      });
    }
  }
  const adminAddress0 = adminContract.zkapp?.appState[0];
  const adminAddress1 = adminContract.zkapp?.appState[1];
  if (adminAddress0 === undefined || adminAddress1 === undefined) {
    throw new Error("Cannot fetch admin address from admin contract");
  }
  const adminAddress = PublicKey.fromFields([adminAddress0, adminAddress1]);

  for (const hash of verificationKeyHashes) {
    const found = Object.values(vk).some((key) => key.hash === hash);
    if (!found) {
      console.error(`Final check: unknown verification key hash: ${hash}`);
      verificationKeyHashes = verificationKeyHashes.filter((h) => h !== hash);
    }
  }

  // Sort verification key hashes by type: upgrade -> admin -> token -> user
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
    adminAddress: adminAddress,
    symbol,
    adminType,
    isToNewAccount,
    verificationKeyHashes,
  };
}
