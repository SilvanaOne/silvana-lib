import { SuiEvent, SuiTransactionBlockResponse } from "@mysten/sui/client";
import {
  ParallelTransactionExecutor,
  Transaction,
} from "@mysten/sui/transactions";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { suiClient } from "./sui-client.js";
import { nanoid } from "nanoid";
import { sleep } from "./sleep.js";

const executors: { [key: string]: ParallelTransactionExecutor } = {};
const locks: { [key: string]: string | undefined } = {};

const LOCK_TIMEOUT = 1000 * 60 * 2; // 5 minutes

async function getLock(address: string): Promise<string | undefined> {
  const id = nanoid();
  let locked = false;
  const start = Date.now();
  while (!locked && Date.now() - start < LOCK_TIMEOUT) {
    if (locks[address]) {
      await sleep(Math.floor(Math.random() * 10) + 10);
    } else {
      locks[address] = id;
      await sleep(10);
      if (locks[address] === id) {
        locked = true;
        return id;
      }
    }
  }
  return undefined;
}

async function releaseLock(params: { address: string; id: string }) {
  const { address, id } = params;
  if (locks[address] === id) {
    locks[address] = undefined;
  }
}

function getExecutor(keyPair: Secp256k1Keypair | Ed25519Keypair) {
  const keyPairId = keyPair.toSuiAddress();
  if (!executors[keyPairId]) {
    executors[keyPairId] = new ParallelTransactionExecutor({
      client: suiClient,
      signer: keyPair,
      initialCoinBalance: 500_000_000n,
      minimumCoinBalance: 300_000_000n,
      maxPoolSize: 5,
    });
    locks[keyPairId] = undefined;
  }
  return executors[keyPairId];
}

export async function executeTx(params: {
  tx: Transaction;
  keyPair: Secp256k1Keypair | Ed25519Keypair;
  useParallelExecutor?: boolean;
  showErrors?: boolean;
}): Promise<
  | {
      tx: SuiTransactionBlockResponse;
      digest: string;
      events: object;
      executeTime: number;
    }
  | undefined
> {
  let lockId: string | undefined;
  let address: string | undefined;
  try {
    const {
      tx,
      keyPair,
      useParallelExecutor = false,
      showErrors = true,
    } = params;
    let executedTx: SuiTransactionBlockResponse;
    let start = 0;
    let end = 0;
    if (useParallelExecutor) {
      address = keyPair.toSuiAddress();
      lockId = await getLock(address);
      if (!lockId) {
        throw new Error("Failed to get lock");
      }
      start = Date.now();
      const executor = getExecutor(keyPair);
      executedTx = (
        await executor.executeTransaction(tx, {
          showEffects: true,
          showObjectChanges: true,
          showInput: true,
          showEvents: true,
          showBalanceChanges: true,
        })
      ).data;
      end = Date.now();
      await waitTx(executedTx.digest);
      await sleep(1000);
      await releaseLock({ address: address, id: lockId });
    } else {
      address = keyPair.toSuiAddress();
      lockId = await getLock(address);
      if (!lockId) {
        throw new Error("Failed to get lock");
      }
      const signedTx = await tx.sign({
        signer: keyPair,
        client: suiClient,
      });
      start = Date.now();
      // const dryRun = await suiClient.devInspectTransactionBlock({
      //   sender: keypair.toSuiAddress(),
      //   transactionBlock: signedTx.bytes
      // });
      // dryRun.effects.gasUsed.computationCost
      // const gasPrice = await suiClient.getReferenceGasPrice();

      executedTx = await suiClient.executeTransactionBlock({
        transactionBlock: signedTx.bytes,
        signature: signedTx.signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showInput: true,
          showEvents: true,
          showBalanceChanges: true,
        },
      });
      end = Date.now();
      await releaseLock({ address, id: lockId });
    }

    if (executedTx?.effects?.status?.status === "failure") {
      if (showErrors) {
        console.log(
          `Errors for tx ${executedTx.digest}:`,
          executedTx?.effects?.status?.error
        );
        throw new Error(`tx execution failed: ${executedTx.digest}`);
      }
    }
    return {
      tx: executedTx,
      digest: executedTx.digest,
      events: (executedTx?.events as SuiEvent[])?.[0]?.parsedJson as object,
      executeTime: end - start,
    };
  } catch (error: any) {
    if (lockId && address) {
      await releaseLock({ address, id: lockId });
    }
    console.error("Error in executeTx", error.message);
    return undefined;
  }
}

export async function waitTx(digest: string) {
  console.time(`wait sui tx`);
  const txWaitResult = await suiClient.waitForTransaction({
    digest,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showInput: true,
      showEvents: true,
      showBalanceChanges: true,
    },
  });
  console.timeEnd(`wait sui tx`);
  return txWaitResult;
}
