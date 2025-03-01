import { checkZkappTransaction } from "o1js";
import { Mina } from "o1js";
import { blockchain } from "../networks.js";
import { sleep } from "../utils/utils.js";
import { fetchMinaAccount } from "../utils/fetch.js";
import { getCurrentNetwork } from "../utils/mina.js";

/**
 * The function `sendTx` sends a transaction, checks account updates, and waits for
 * confirmation on the blockchain.
 * @param params The parameters object
 * @param params.tx The transaction to send
 * @param params.description A description of the transaction
 * @param params.verbose Whether to log verbose information
 * @param params.wait Whether to wait for the transaction to be included in a block
 * @param params.chain The blockchain to send the transaction on
 * @returns The `sendTx` function returns a `Mina.IncludedTransaction`, `Mina.PendingTransaction`,
 * `Mina.RejectedTransaction`, or `undefined` if there was an error during the process.
 */
export async function sendTx(params: {
  tx: Mina.Transaction<false, true> | Mina.Transaction<true, true>;
  description?: string;
  retry?: number;
  verbose?: boolean;
  wait?: boolean;
  chain?: blockchain;
  delay?: number;
}): Promise<
  | Mina.IncludedTransaction
  | Mina.PendingTransaction
  | Mina.RejectedTransaction
  | undefined
> {
  const {
    tx,
    description = "",
    verbose = true,
    wait = true,
    chain = getCurrentNetwork().network.chainId,
    delay = chain === "zeko" || chain === "lightnet" ? 5000 : 60000,
    retry = 30,
  } = params;
  // flatten accountUpdates
  const accountUpdates = JSON.parse(tx.toJSON()).accountUpdates;
  const auCount: {
    publicKey: string;
    tokenId: string | undefined;
    count: number;
  }[] = [];
  let proofAuthorizationCount = 0;
  // Calculate the number of account updates for each { publicKey, tokenId }
  for (const au of accountUpdates) {
    const { publicKey, tokenId, authorizationKind } = au.body;
    if (au.authorization.proof) {
      proofAuthorizationCount++;
      if (authorizationKind.isProved === false)
        console.error("Proof authorization exists but isProved is false");
    } else if (authorizationKind.isProved === true)
      console.error("isProved is true but no proof authorization");
    const index = auCount.findIndex(
      (item) => item.publicKey === publicKey && item.tokenId === tokenId
    );
    if (index === -1) auCount.push({ publicKey, tokenId, count: 1 });
    else auCount[index].count++;
  }
  if (verbose)
    console.log(
      `Account updates for ${description ?? "tx"}: ${
        auCount.length
      }, proof authorizations: ${proofAuthorizationCount}`
    );
  for (const au of auCount) {
    if (au.count > 1)
      if (verbose)
        console.log(
          `DUPLICATE AU ${description ?? ""}: ${au.publicKey}  ${
            au.tokenId !== "wSHV2S4qX9jFsLjQo8r1BsMLH2ZRKsZx6EJd1sbozGPieEC4Jf"
              ? "tokenId: " + au.tokenId
              : ""
          } count: ${au.count}`
        );
  }
  try {
    let txSent;
    let sent = false;
    let attempt = 1;
    while (!sent && attempt <= retry) {
      txSent = await tx.safeSend();
      if (txSent.status === "pending") {
        sent = true;
        if (verbose)
          console.log(
            `${description ?? ""} tx sent: hash: ${txSent.hash} status: ${
              txSent.status
            }`
          );
      } else if (chain !== "local") {
        attempt++;
        console.error(
          `${description} tx NOT sent: hash: ${txSent?.hash} status: ${
            txSent?.status
          }, errors: ${String(txSent.errors ?? "")}`
        );
        if (verbose) console.log(`Retrying ${chain} tx, retry:`, attempt);
        await sleep(10000 * attempt);
      } else attempt = retry + 1; // local chain - do not retry
    }
    if (txSent === undefined) throw new Error("txSent is undefined");
    if ((txSent.errors?.length ?? 0) > 0) {
      console.error(
        `${description ?? ""} tx error: hash: ${txSent.hash} status: ${
          txSent.status
        }  errors: ${String(txSent.errors ?? "")}`
      );
    }

    if (txSent.status === "pending" && wait !== false && chain !== "zeko") {
      if (verbose) console.log(`Waiting for tx inclusion...`);
      let txIncluded = await txSent.safeWait();
      if (txIncluded.status !== "included") {
        console.error(
          `${description ?? ""} tx NOT included into block: hash: ${
            txIncluded.hash
          } status: ${txIncluded.status}, errors: ${String(
            txIncluded.errors ?? ""
          )}`
        );
      }
      if (chain !== "local") {
        // we still wait for the tx to be included in the block by checking the nonce
        // even in the case of tx NOT included
        // because the tx might still be included in the block in the case of devnet instability
        const { publicKey, nonce } = tx.transaction.feePayer.body;
        const started = Date.now();
        while (Date.now() - started < 1000 * 60 * 10) {
          const newNonce = (
            await fetchMinaAccount({
              publicKey,
              force: true,
            })
          ).account?.nonce;
          if (
            newNonce &&
            Number(newNonce.toBigint()) > Number(nonce.toBigint())
          ) {
            let txIncluded = await txSent.safeWait();
            if (txIncluded.status === "included") {
              if (verbose)
                console.log(
                  `${description ?? ""} tx included into block: hash: ${
                    txIncluded.hash
                  } status: ${txIncluded.status}`
                );
              if (delay > 0) await sleep(delay);
              return txIncluded;
            } else if (txIncluded.status === "rejected") {
              // We never should see this error as the nonce is updated (except when tx failed due to a preconditions),
              // so we retry to check if the tx is included
              console.error(
                `tx rejected: ${chain}: hash: ${txIncluded.hash} status: ${txIncluded.status} errors: ${txIncluded.errors}`
              );
              await sleep(30000);
              txIncluded = await txSent.safeWait();
              if (txIncluded.status === "included") {
                if (verbose)
                  console.log(
                    `${description ?? ""} tx included into block: hash: ${
                      txIncluded.hash
                    } status: ${txIncluded.status}`
                  );
                if (delay > 0) await sleep(delay);
                return txIncluded;
              }
              console.error(
                `tx failed: ${chain}: hash: ${txIncluded.hash} status: ${txIncluded.status} errors: ${txIncluded.errors}`
              );
              return txIncluded;
            }
          }
          if (verbose)
            console.log(
              `Waiting for ${chain} to update state for ${Math.floor(
                (Date.now() - started) / 1000
              )} sec...`
            );
          await sleep(30000);
        }
        // finally, if the tx is still not included, show an error
        console.error(
          `${chain} do not reflect nonce update for tx ${txIncluded.hash} with status ${txIncluded.status}`
        );
      }
      if (verbose)
        console.log(
          `${description ?? ""} tx included into block: hash: ${
            txIncluded.hash
          } status: ${txIncluded.status}`
        );
      return txIncluded;
    } else return txSent;
  } catch (error) {
    if (chain !== "zeko") console.error("Error sending tx", error);
  }
}

export async function getTxStatusFast(params: {
  hash: string;
  chain?: blockchain;
}): Promise<{ success: boolean; result?: boolean; error?: string }> {
  const { hash, chain = getCurrentNetwork().network.chainId } = params;
  if (chain === "local" || chain === "zeko")
    return { success: true, result: true };

  try {
    const txStatus = await checkZkappTransaction(hash);
    return {
      success: true,
      result: txStatus?.success ?? false,
    };
  } catch (error: any) {
    console.error(
      "getTxStatusFast error while getting tx status - catch",
      hash,
      error
    );
    return { success: false, error: error?.message ?? "Cannot get tx status" };
  }
}
