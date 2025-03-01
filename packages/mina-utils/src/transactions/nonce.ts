import { BlockBerryChain } from "./chain.js";
import {
  getZkAppTxsFromBlockBerry,
  getPaymentTxsFromBlockBerry,
} from "./blockberry.js";
import { fetchMinaAccount } from "../utils/fetch.js";
import { getCurrentNetwork } from "../utils/mina.js";
import { Mina, PublicKey } from "o1js";
import { blockchain } from "../networks.js";

export async function getNonce(params: {
  account: string;
  chain: BlockBerryChain;
  blockBerryApiKey: string;
}): Promise<{
  success: boolean;
  nonce: number;
  message?: string;
}> {
  const { account, chain, blockBerryApiKey } = params;
  try {
    if (account === undefined || account === null || account === "") {
      return {
        success: false,
        nonce: -1,
        message: "Account is required",
      };
    }

    if (
      blockBerryApiKey === undefined ||
      blockBerryApiKey === null ||
      blockBerryApiKey === ""
    ) {
      return {
        success: false,
        nonce: -1,
        message: "blockBerryApiKey is required",
      };
    }
    const zkAppTxsPromise = getZkAppTxsFromBlockBerry({
      account,
      chain,
      blockBerryApiKey,
    });
    const paymentTxs = getPaymentTxsFromBlockBerry({
      account,
      chain,
      blockBerryApiKey,
    });

    const paymentNonce = (await paymentTxs)?.data[0]?.nonce ?? -1;
    let zkNonce = -1;
    let found = false;
    const zkAppTxs = await zkAppTxsPromise;
    const size = zkAppTxs?.data?.length ?? 0;
    let i = 0;
    while (!found && i < size) {
      if (zkAppTxs?.data[i]?.proverAddress === account) {
        zkNonce = zkAppTxs?.data[i]?.nonce;
        found = true;
      }
      i++;
    }
    const nonce = Math.max(zkNonce, paymentNonce);

    return {
      success: true,
      nonce,
    };
  } catch (error) {
    return {
      success: false,
      nonce: -1,
      message: String(error),
    };
  }
}

export async function getAccountNonce(params: {
  account: string;
  chain?: blockchain;
  blockBerryApiKey?: string;
  verbose?: boolean;
}): Promise<number> {
  const {
    account,
    chain = getCurrentNetwork().network.chainId,
    blockBerryApiKey,
    verbose = true,
  } = params;
  const canUseBlockBerry =
    blockBerryApiKey !== undefined &&
    (chain === "devnet" || chain === "mainnet");
  if (chain === "zeko") {
    const publicKey = PublicKey.fromBase58(account);
    await fetchMinaAccount({ publicKey });
    const nonce = Number(Mina.getAccount(publicKey).nonce.toBigint());
    return nonce;
  } else {
    const blockberryNoncePromise = canUseBlockBerry
      ? getNonce({
          account,
          blockBerryApiKey,
          chain,
        })
      : undefined;
    const publicKey = PublicKey.fromBase58(account);
    await fetchMinaAccount({ publicKey });
    const senderNonce = Number(Mina.getAccount(publicKey).nonce.toBigint());
    const blockberryNonce = blockberryNoncePromise
      ? (await blockberryNoncePromise).nonce ?? -1
      : -1;
    const nonce = Math.max(senderNonce, blockberryNonce + 1);
    if (verbose && nonce > senderNonce)
      console.log(
        `Nonce changed from ${senderNonce} to ${nonce} for ${account}`
      );
    return nonce;
  }
}
