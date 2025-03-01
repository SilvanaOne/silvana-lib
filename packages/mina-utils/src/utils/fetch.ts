import {
  PublicKey,
  Field,
  Mina,
  fetchAccount,
  checkZkappTransaction,
} from "o1js";
import { sleep } from "./utils.js";

/**
 * Fetches the Mina account for a given public key with error handling
 * @param params the parameters for fetching the account
 * @param params.publicKey the public key of the account
 * @param params.tokenId the token id of the account
 * @param params.force whether to force the fetch - use it only if you are sure the account exists
 * @returns the account object
 */
export async function fetchMinaAccount(params: {
  publicKey: string | PublicKey;
  tokenId?: string | Field | undefined;
  force?: boolean;
}) {
  const { publicKey, tokenId, force = false } = params;
  const timeout = 1000 * 60 * 3; // 3 minutes
  let attempt = 0;
  const startTime = Date.now();
  let result = { account: undefined };
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fetchAccount(
        {
          publicKey,
          tokenId,
        },
        undefined,
        { timeout: 5 * 1000 }
      );
      return result;
    } catch (error: any) {
      if (force === true)
        console.log("Error in fetchMinaAccount:", {
          error,
          publicKey:
            typeof publicKey === "string" ? publicKey : publicKey.toBase58(),
          tokenId: tokenId?.toString(),
          force,
        });
      else {
        console.log("fetchMinaAccount error", {
          error,
          publicKey:
            typeof publicKey === "string" ? publicKey : publicKey.toBase58(),
          tokenId: tokenId?.toString(),
          force,
        });
        return result;
      }
    }
    attempt++;
    await sleep(1000 * 6 * attempt); // to handle rate limit we increase the interval
  }
  if (force === true)
    throw new Error(
      `fetchMinaAccount timeout
      ${{
        publicKey:
          typeof publicKey === "string" ? publicKey : publicKey.toBase58(),
        tokenId: tokenId?.toString(),
        force,
      }}`
    );
  else
    console.log(
      "fetchMinaAccount timeout",
      typeof publicKey === "string" ? publicKey : publicKey.toBase58(),
      tokenId?.toString(),
      force
    );
  return result;
}

/**
 * Fetches the Mina actions for a given public key with error handling
 * @param publicKey the public key of the contract
 * @param fromActionState the starting action state
 * @param endActionState the ending action state
 * @returns the actions array
 */

export async function fetchMinaActions(
  publicKey: PublicKey,
  fromActionState: Field,
  endActionState?: Field
) {
  const timeout = 1000 * 60 * 600; // 10 hours
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      let actions = await Mina.fetchActions(publicKey, {
        fromActionState,
        endActionState,
      });
      if (Array.isArray(actions)) return actions;
      else console.log("Cannot fetch actions - wrong format");
    } catch (error: any) {
      console.log(
        "Error in fetchMinaActions",
        error.toString().substring(0, 300)
      );
    }
    await sleep(1000 * 60 * 2);
  }
  console.log("Timeout in fetchMinaActions");
  return undefined;
}

/**
 * Fetches the Mina transaction for a given hash with error handling
 * @param hash the hash of the transaction
 * @returns the transaction object
 */
export async function checkMinaZkappTransaction(hash: string) {
  try {
    const result = await checkZkappTransaction(hash);
    return result;
  } catch (error) {
    console.error("Error in checkZkappTransaction:", error);
    return { success: false };
  }
}
