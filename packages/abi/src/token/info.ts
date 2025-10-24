import { Mina, PublicKey, TokenId, Field } from "o1js";
import { fetchMinaAccount } from "../fetch.js";
import {
  BalanceRequestParams,
  BalanceResponse,
  CanonicalBlockchain,
} from "@silvana-one/api";
import { checkAddress } from "../info/address.js";
import { FungibleToken } from "@silvana-one/token";
import { ContractInfo } from "@silvana-one/api";
import { tokenVerificationKeys } from "../vk/vk.js";

export async function getContractInfo(params: {
  address: string | PublicKey;
  tokenId?: string | Field;
  parentTokenId?: Field;
  decimals?: number;
  chain: CanonicalBlockchain;
}): Promise<ContractInfo[]> {
  const { address, chain, parentTokenId, decimals } = params;
  const vk =
    tokenVerificationKeys[chain === "mina:mainnet" ? "mainnet" : "devnet"].vk;
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
    // TODO: add NFT and Bonding Curve
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
      hasAccount: Mina.hasAccount(publicKey, tokenId),
      balance: Mina.hasAccount(publicKey, tokenId)
        ? Number(Mina.getAccount(publicKey, tokenId).balance.toBigInt())
        : undefined,
    };
  } catch (error) {
    console.error("Cannot fetch account balance", params, error);

    return {
      tokenAddress,
      address,
      tokenId: tokenId ? TokenId.toBase58(tokenId) : undefined,
      hasAccount: undefined,
      balance: undefined,
    };
  }
}
