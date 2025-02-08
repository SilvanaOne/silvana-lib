import { Mina, PublicKey, Bool, TokenId, Struct, UInt8, Field } from "o1js";
import { fetchMinaAccount } from "../fetch.js";
import {
  TokenState,
  TokenInfoRequestParams,
  BalanceRequestParams,
  BalanceResponse,
} from "@silvana-one/api";
import { checkAddress } from "../info/address.js";
import {
  FungibleToken,
  AdvancedFungibleToken,
  FungibleTokenAdmin,
  FungibleTokenAdvancedAdmin,
  FungibleTokenBidContract,
  FungibleTokenOfferContract,
  FungibleTokenClaimContract,
} from "@silvana-one/token";
import { ContractInfo } from "@silvana-one/api";
import { tokenVerificationKeys } from "../vk/vk.js";

export async function getContractInfo(params: {
  address: string | PublicKey;
  tokenId?: string | Field;
  parentTokenId?: Field;
  decimals?: number;
  chain: "mainnet" | "devnet";
}): Promise<ContractInfo[]> {
  const { address, chain, parentTokenId, decimals } = params;
  const vk = tokenVerificationKeys[chain].vk;
  const info: ContractInfo[] = [];
  if (typeof address === "string" && !checkAddress(address)) {
    throw new Error("Invalid address");
  }
  const publicKey =
    typeof address === "string" ? PublicKey.fromBase58(address) : address;
  const tokenId = params.tokenId
    ? typeof params.tokenId === "string"
      ? TokenId.fromBase58(params.tokenId)
      : params.tokenId
    : undefined;
  await fetchMinaAccount({ publicKey, tokenId, force: false });
  if (!Mina.hasAccount(publicKey, tokenId)) {
    throw new Error("Account does not exist");
  }
  const account = Mina.getAccount(publicKey, tokenId);
  if (account.zkapp?.appState === undefined) {
    throw new Error("The account is not a zkApp");
  }

  const tokenSymbol = account.tokenSymbol;
  const uri = account.zkapp?.zkappUri;
  const verificationKey = account.zkapp?.verificationKey?.data;
  const verificationKeyHash = account.zkapp?.verificationKey?.hash.toJSON();

  const versionData = account.zkapp?.zkappVersion;
  const version = Number(versionData.toBigint());
  const name = Object.keys(vk).find(
    (key) => vk[key].hash === verificationKeyHash
  );
  const derivedTokenId = TokenId.derive(publicKey, tokenId);
  const info0: ContractInfo = {
    name: { type: "name", value: name ?? "unknown" },
    address: { type: "address", value: publicKey.toBase58() },
    tokenId: {
      type: "tokenId",
      value: TokenId.toBase58(tokenId ?? Field.from(1)),
    },
    derivedTokenId: {
      type: "tokenId",
      value: TokenId.toBase58(derivedTokenId),
    },
    symbol: { type: "symbol", value: tokenSymbol },
    uri: { type: "uri", value: uri },
    verificationKey: { type: "verificationKey", value: verificationKey ?? "" },
    verificationKeyHash: {
      type: "verificationKeyHash",
      value: verificationKeyHash ?? "",
    },
    zkappVersion: { type: "zkappVersion", value: version.toString() },
  };

  switch (name) {
    case "FungibleToken":
    case "AdvancedFungibleToken":
      {
        const zkApp = new FungibleToken(publicKey, tokenId);
        const admin = zkApp.admin.get();
        const decimals = zkApp.decimals.get();
        const paused = zkApp.paused.get();
        const zkAppTokenId = zkApp.deriveTokenId();
        if (TokenId.toBase58(zkAppTokenId) !== info0.derivedTokenId.value) {
          throw new Error("Derived tokenId does not match");
        }
        await fetchMinaAccount({
          publicKey,
          tokenId: zkAppTokenId,
          force: false,
        });
        const totalSupply = Mina.getBalance(publicKey, zkAppTokenId).toBigInt();
        info0.admin = { type: "address", value: admin.toBase58() };
        info0.decimals = {
          type: "number",
          value: decimals.toNumber().toString(),
        };
        info0.paused = {
          type: "boolean",
          value: paused.toBoolean().toString(),
        };
        info0.totalSupply = {
          type: "bigint",
          value: totalSupply.toString(),
          presentation: formatBalanceInternal(
            Number(totalSupply / BigInt(10 ** decimals.toNumber()))
          ),
        };
        const info1: ContractInfo[] = await getContractInfo({
          address: admin,
          parentTokenId: zkAppTokenId,
          decimals: decimals.toNumber(),
          chain,
        });
        info.push(...info1);
      }
      break;

    case "FungibleTokenAdmin":
      {
        const adminAddress0 = account.zkapp?.appState[0];
        const adminAddress1 = account.zkapp?.appState[1];
        if (adminAddress0 === undefined || adminAddress1 === undefined) {
          throw new Error("Cannot fetch admin address from admin contract");
        }
        const adminAddress = PublicKey.fromFields([
          adminAddress0,
          adminAddress1,
        ]);
        let adminTokenBalance: bigint = 0n;
        if (parentTokenId) {
          try {
            await fetchMinaAccount({
              publicKey: adminAddress,
              tokenId: parentTokenId,
              force: false,
            });
            adminTokenBalance = Mina.getBalance(
              adminAddress,
              parentTokenId
            ).toBigInt();
          } catch (error) {}
        }
        info0.admin = { type: "address", value: adminAddress.toBase58() };
        info0.adminTokenBalance = {
          type: "bigint",
          value: adminTokenBalance.toString(),
          presentation: formatBalanceInternal(
            Number(adminTokenBalance / BigInt(1 << (decimals ?? 9)))
          ),
        };
      }
      break;
  }
  info.push(info0);
  return info;
}

function formatBalanceInternal(num: number): string {
  const fixed = num.toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

export async function tokenBalance(
  params: BalanceRequestParams
): Promise<BalanceResponse> {
  const { tokenAddress, address } = params;

  if (!address || !checkAddress(address)) {
    throw new Error("Invalid address");
  }

  if (tokenAddress && !checkAddress(tokenAddress)) {
    throw new Error("Invalid token address");
  }

  const tokenContractPublicKey = tokenAddress
    ? PublicKey.fromBase58(tokenAddress)
    : undefined;
  const publicKey = PublicKey.fromBase58(address);
  const tokenIdDerived = tokenContractPublicKey
    ? TokenId.derive(tokenContractPublicKey)
    : undefined;

  if (
    tokenIdDerived &&
    params.tokenId &&
    TokenId.toBase58(tokenIdDerived) !== params.tokenId
  ) {
    throw new Error("TokenId does not match tokenAddress");
  }
  const tokenId =
    tokenIdDerived ??
    (params.tokenId ? TokenId.fromBase58(params.tokenId) : undefined);

  try {
    await fetchMinaAccount({
      publicKey,
      tokenId,
      force: false,
    });
    return {
      tokenAddress,
      address,
      tokenId: tokenId ? TokenId.toBase58(tokenId) : undefined,
      balance: Mina.hasAccount(publicKey, tokenId)
        ? Number(Mina.getAccount(publicKey, tokenId).balance.toBigInt())
        : null,
    };
  } catch (error) {
    console.error("Cannot fetch account balance", params, error);

    return {
      tokenAddress,
      address,
      tokenId: tokenId ? TokenId.toBase58(tokenId) : undefined,
      balance: null,
    };
  }
}

// export async function offerInfo(
//   params: OfferInfoRequest,
//   apiKeyAddress: string
// ): Promise<ApiResponse<OfferInfo>> {
//   const { tokenAddress, offerAddress } = params;

//   try {
//     await initBlockchain();

//     if (!offerAddress || !checkAddress(offerAddress)) {
//       return {
//         status: 400,
//         json: { error: "Invalid offer address" },
//       };
//     }

//     if (!tokenAddress || !checkAddress(tokenAddress)) {
//       return {
//         status: 400,
//         json: { error: "Invalid token address" },
//       };
//     }

//     const tokenContractPublicKey = PublicKey.fromBase58(tokenAddress);
//     const offerPublicKey = PublicKey.fromBase58(offerAddress);
//     const tokenId = TokenId.derive(tokenContractPublicKey);

//     await fetchMinaAccount({
//       publicKey: offerPublicKey,
//       tokenId,
//       force: false,
//     });
//     if (!Mina.hasAccount(offerPublicKey, tokenId)) {
//       return {
//         status: 400,
//         json: { error: "Offer account not found" },
//       };
//     }
//     const offer = new FungibleTokenOfferContract(offerPublicKey, tokenId);
//     const price = Number(offer.price.get().toBigInt());
//     const amount = Number(
//       Mina.getAccount(offerPublicKey, tokenId).balance.toBigInt()
//     );
//     const ownerAddress = offer.seller.get().toBase58();
//     const offerInfo = await getOffer({ tokenAddress, offerAddress });
//     if (
//       offerInfo === null ||
//       amount !== Number(offerInfo?.amount) ||
//       price !== Number(offerInfo?.price) ||
//       ownerAddress !== offerInfo?.ownerAddress
//     ) {
//       writeOffer({
//         tokenAddress,
//         offerAddress,
//         amount,
//         price,
//         ownerAddress,
//       });
//     }

//     return {
//       status: 200,
//       json: {
//         tokenAddress,
//         offerAddress,
//         ownerAddress,
//         amount,
//         price,
//       },
//     };
//   } catch (error) {
//     console.error("Cannot fetch offer info", params, error);
//     return {
//       status: 500,
//       json: { error: "Failed to get offer info" },
//     };
//   }
// }

// export async function bidInfo(
//   params: BidInfoRequest,
//   apiKeyAddress: string
// ): Promise<ApiResponse<BidInfo>> {
//   const { tokenAddress, bidAddress } = params;

//   try {
//     await initBlockchain();

//     if (!bidAddress || !checkAddress(bidAddress)) {
//       return {
//         status: 400,
//         json: { error: "Invalid bid address" },
//       };
//     }

//     if (!tokenAddress || !checkAddress(tokenAddress)) {
//       return {
//         status: 400,
//         json: { error: "Invalid token address" },
//       };
//     }

//     const tokenContractPublicKey = PublicKey.fromBase58(tokenAddress);
//     const bidPublicKey = PublicKey.fromBase58(bidAddress);
//     const tokenId = TokenId.derive(tokenContractPublicKey);

//     await fetchMinaAccount({
//       publicKey: bidPublicKey,
//       force: false,
//     });
//     if (!Mina.hasAccount(bidPublicKey)) {
//       return {
//         status: 400,
//         json: { error: "Bid account not found" },
//       };
//     }
//     const bid = new FungibleTokenBidContract(bidPublicKey);
//     const price = Number(bid.price.get().toBigInt());
//     const amount = Number(Mina.getAccount(bidPublicKey).balance.toBigInt());
//     const ownerAddress = bid.buyer.get().toBase58();
//     const bidInfo = await getBid({ tokenAddress, bidAddress });
//     if (
//       bidInfo === null ||
//       amount !== Number(bidInfo?.amount) ||
//       price !== Number(bidInfo?.price) ||
//       ownerAddress !== bidInfo?.ownerAddress
//     ) {
//       writeBid({
//         tokenAddress,
//         bidAddress,
//         amount,
//         price,
//         ownerAddress,
//       });
//     }

//     return {
//       status: 200,
//       json: {
//         tokenAddress,
//         bidAddress,
//         ownerAddress,
//         amount,
//         price,
//       },
//     };
//   } catch (error) {
//     console.error("Cannot fetch bid info", params, error);
//     return {
//       status: 500,
//       json: { error: "Failed to get bid info" },
//     };
//   }
// }

// class FungibleTokenState extends Struct({
//   decimals: UInt8,
//   admin: PublicKey,
//   paused: Bool,
// }) {}

// const FungibleTokenStateSize = FungibleTokenState.sizeInFields();

// class FungibleTokenAdminState extends Struct({
//   adminPublicKey: PublicKey,
// }) {}

// const FungibleTokenAdminStateSize = FungibleTokenAdminState.sizeInFields();

// export async function getTokenState(props: {
//   params: TokenInfoRequestParams;
//   name: ApiName;
//   apiKeyAddress: string;
// }): Promise<ApiResponse<TokenState>> {
//   const { params, name, apiKeyAddress } = props;
//   const { tokenAddress } = params;
//   try {
//     await initBlockchain();
//     if (!checkAddress(tokenAddress)) {
//       return {
//         status: 400,
//         json: { error: "Invalid token address" },
//       };
//     }
//     const tokenContractPublicKey = PublicKey.fromBase58(tokenAddress);

//     await fetchMinaAccount({ publicKey: tokenContractPublicKey, force: false });
//     if (!Mina.hasAccount(tokenContractPublicKey)) {
//       return {
//         status: 400,
//         json: { error: "Token contract account not found" },
//       };
//     }
//     const tokenId = TokenId.derive(tokenContractPublicKey);
//     await fetchMinaAccount({
//       publicKey: tokenContractPublicKey,
//       tokenId,
//       force: false,
//     });
//     if (!Mina.hasAccount(tokenContractPublicKey, tokenId)) {
//       console.error(
//         "getTokenState: Token contract totalSupply account not found",
//         {
//           tokenAddress,
//         }
//       );
//       return {
//         status: 400,
//         json: { error: "Token contract totalSupply account not found" },
//       };
//     }
//     const account = Mina.getAccount(tokenContractPublicKey);
//     if (account.zkapp?.appState === undefined) {
//       console.error("getTokenState: Token contract state not found", {
//         tokenAddress,
//       });
//       return {
//         status: 400,
//         json: { error: "Token contract state not found" },
//       };
//     }
//     const state = FungibleTokenState.fromFields(
//       account.zkapp?.appState.slice(0, FungibleTokenStateSize)
//     );
//     const adminContractPublicKey = state.admin;
//     const decimals = state.decimals.toNumber();
//     const isPaused = state.paused.toBoolean();
//     const totalSupply =
//       Number(Mina.getBalance(tokenContractPublicKey, tokenId).toBigInt()) /
//       1_000_000_000;
//     const tokenSymbol = account.tokenSymbol;
//     const uri = account.zkapp?.zkappUri;

//     if (uri === undefined) {
//       console.error("getTokenState: Token uri not found", {
//         tokenAddress,
//       });
//       return {
//         status: 400,
//         json: { error: "Token uri not found" },
//       };
//     }
//     const verificationKeyHash = account.zkapp?.verificationKey?.hash.toJSON();
//     if (verificationKeyHash === undefined) {
//       console.error("getTokenState: Token verification key hash not found", {
//         tokenAddress,
//       });
//       return {
//         status: 400,
//         json: { error: "Token verification key hash not found" },
//       };
//     }
//     const versionData = account.zkapp?.zkappVersion;
//     if (versionData === undefined) {
//       console.error("getTokenState: Token contract version not found", {
//         tokenAddress,
//       });
//       return {
//         status: 400,
//         json: { error: "Token contract version not found" },
//       };
//     }
//     const version = Number(versionData.toBigint());

//     await fetchMinaAccount({ publicKey: adminContractPublicKey, force: false });
//     if (!Mina.hasAccount(adminContractPublicKey)) {
//       console.error("getTokenState: Admin contract account not found", {
//         tokenAddress,
//       });
//       return {
//         status: 400,
//         json: { error: "Admin contract account not found" },
//       };
//     }

//     const adminContract = Mina.getAccount(adminContractPublicKey);
//     const adminTokenSymbol = adminContract.tokenSymbol;
//     const adminUri = adminContract.zkapp?.zkappUri;

//     const adminVerificationKeyHash =
//       adminContract.zkapp?.verificationKey?.hash.toJSON();
//     if (adminVerificationKeyHash === undefined) {
//       console.error(
//         "getTokenState: Admin contract verification key hash not found",
//         {
//           adminContractPublicKey: adminContractPublicKey.toBase58(),
//         }
//       );
//       return {
//         status: 400,
//         json: { error: "Admin contract verification key hash not found" },
//       };
//     }
//     const adminVersionData = adminContract.zkapp?.zkappVersion;
//     if (adminVersionData === undefined) {
//       console.error("getTokenState: Admin contract version not found", {
//         adminContractPublicKey: adminContractPublicKey.toBase58(),
//       });
//       return {
//         status: 400,
//         json: { error: "Admin contract version not found" },
//       };
//     }
//     const adminVersion = Number(adminVersionData.toBigint());
//     const adminAddress0 = adminContract.zkapp?.appState[0];
//     const adminAddress1 = adminContract.zkapp?.appState[1];
//     if (adminAddress0 === undefined || adminAddress1 === undefined) {
//       console.error("Cannot fetch admin address from admin contract");
//       return {
//         status: 400,
//         json: { error: "Cannot fetch admin address from admin contract" },
//       };
//     }
//     const adminAddress = PublicKey.fromFields([adminAddress0, adminAddress1]);
//     let adminTokenBalance = 0;
//     try {
//       await fetchMinaAccount({
//         publicKey: adminAddress,
//         tokenId,
//         force: false,
//       });
//       adminTokenBalance = Number(
//         Mina.getBalance(adminAddress, tokenId).toBigInt()
//       );
//     } catch (error) {}

//     const tokenState: TokenState = {
//       tokenAddress: tokenContractPublicKey.toBase58(),
//       tokenId: TokenId.toBase58(tokenId),
//       adminContractAddress: adminContractPublicKey.toBase58(),
//       adminAddress: adminAddress.toBase58(),
//       adminTokenBalance,
//       totalSupply,
//       isPaused,
//       decimals,
//       tokenSymbol,
//       verificationKeyHash,
//       uri,
//       version,
//       adminTokenSymbol,
//       adminUri: adminUri ?? "",
//       adminVerificationKeyHash,
//       adminVersion,
//     };

//     const updated = await updateTokenInfo({
//       tokenAddress,
//       tokenState,
//     });
//     if (updated) {
//       console.log("getTokenState: Updated token info", {
//         tokenAddress,
//         symbol: tokenState.tokenSymbol,
//       });
//     }
//     return {
//       status: 200,
//       json: tokenState,
//     };
//   } catch (error: any) {
//     console.error("getTokenState catch", error);
//     return {
//       status: 503,
//       json: {
//         error:
//           "getTokenState error:" +
//           (error?.message ?? (error ? String(error) : "unknown error")),
//       },
//     };
//   }
// }
