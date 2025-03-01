import { Field, PublicKey, Transaction, Mina, UInt64 } from "o1js";
import { TransactionPayloads } from "@silvana-one/api";
import { fieldToBase64, fieldFromBase64 } from "../utils/base64-field.js";

export function createTransactionPayloads(
  tx: Mina.Transaction<false, false> | Mina.Transaction<false, true>
): TransactionPayloads {
  const transaction = tx.toJSON();
  const txJSON = JSON.parse(transaction);
  const signedData = JSON.stringify({ zkappCommand: txJSON });
  const proverPayload = serializeTransaction(tx);
  const fee = tx.transaction.feePayer.body.fee.toJSON();
  const sender = tx.transaction.feePayer.body.publicKey.toBase58();
  const nonce = Number(tx.transaction.feePayer.body.nonce.toBigint());
  const memo = tx.transaction.memo;
  const minaSignerPayload = {
    zkappCommand: txJSON,
    feePayer: {
      feePayer: sender,
      fee,
      nonce,
      memo,
    },
  };
  const walletPayload = {
    transaction,
    nonce,
    onlySign: true,
    feePayer: {
      fee,
      memo,
    },
  };

  return {
    sender,
    nonce,
    memo,
    fee,
    walletPayload,
    minaSignerPayload,
    proverPayload,
    signedData,
    transaction,
  };
}

interface ForestSerialized {
  length: number;
  restoredItems?: number;
  items: {
    h?: string; // hash
    p?: string; // previousHash
    i?: number; // id
    c?: string; // callData
  }[];
}

export function transactionParams(
  params:
    | {
        proverPayload: string;
        signedData: string;
      }
    | TransactionPayloads
): {
  fee: UInt64;
  sender: PublicKey;
  nonce: number;
  memo: string;
} {
  const { proverPayload, signedData } = params;
  const signedJson = JSON.parse(signedData);
  const { sender, tx } = JSON.parse(proverPayload);
  const transaction = Mina.Transaction.fromJSON(JSON.parse(tx));
  const memo = transaction.transaction.memo;
  return {
    fee: UInt64.from(signedJson.zkappCommand.feePayer.body.fee),
    sender: PublicKey.fromBase58(sender),
    nonce: Number(signedJson.zkappCommand.feePayer.body.nonce),
    memo,
  };
}

export function parseTransactionPayloads(
  params:
    | {
        proverPayload: string;
        signedData: string;
        txNew: Mina.Transaction<false, false> | Mina.Transaction<false, true>;
      }
    | {
        payloads: TransactionPayloads;
        txNew: Mina.Transaction<false, false> | Mina.Transaction<false, true>;
      }
): Transaction<false, true> {
  const { txNew } = params;
  const proverPayload =
    "payloads" in params ? params.payloads.proverPayload : params.proverPayload;
  const signedData =
    "payloads" in params ? params.payloads.signedData : params.signedData;
  const signedJson = JSON.parse(signedData);
  const { tx, blindingValues, length, forestJSONs } = JSON.parse(proverPayload);
  const transaction = Mina.Transaction.fromJSON(JSON.parse(tx));
  const forests: ForestSerialized[] = forestJSONs.map(
    (f: string) => JSON.parse(f) as ForestSerialized
  );

  if (length !== txNew.transaction.accountUpdates.length) {
    throw new Error(
      `New Transaction length mismatch: ${length} !== ${txNew.transaction.accountUpdates.length}`
    );
  }
  if (length !== transaction.transaction.accountUpdates.length) {
    throw new Error(
      `Serialized Transaction length mismatch: ${length} !== ${transaction.transaction.accountUpdates.length}`
    );
  }
  for (let i = 0; i < length; i++) {
    transaction.transaction.accountUpdates[i].lazyAuthorization =
      txNew.transaction.accountUpdates[i].lazyAuthorization;
    if (blindingValues[i] !== "") {
      if (
        transaction.transaction.accountUpdates[i].lazyAuthorization ===
          undefined ||
        (transaction.transaction.accountUpdates[i].lazyAuthorization as any)
          .blindingValue === undefined
      ) {
        throw new Error(
          `Lazy authorization blinding value is undefined for item ${i}`
        );
      }
      (
        transaction.transaction.accountUpdates[i].lazyAuthorization as any
      ).blindingValue = Field.fromJSON(blindingValues[i]);
    }
    if (forests[i].length > 0) {
      if (
        transaction.transaction.accountUpdates[i].lazyAuthorization ===
          undefined ||
        (transaction.transaction.accountUpdates[i].lazyAuthorization as any)
          .args === undefined
      ) {
        throw new Error(`Lazy authorization args is undefined for item ${i}`);
      }
      deserializeLazyAuthorization(
        (transaction.transaction.accountUpdates[i].lazyAuthorization as any)
          .args,
        forests[i]
      );
      if (forests[i].restoredItems !== forests[i].length) {
        throw new Error(`Forest ${i} not fully restored`);
      }
    }
  }
  transaction.transaction.feePayer.authorization =
    signedJson.zkappCommand.feePayer.authorization;
  transaction.transaction.feePayer.body.fee = UInt64.from(
    signedJson.zkappCommand.feePayer.body.fee
  );
  for (let i = 0; i < length; i++) {
    const signature =
      signedJson.zkappCommand.accountUpdates[i].authorization.signature;
    if (signature !== undefined && signature !== null) {
      transaction.transaction.accountUpdates[i].authorization.signature =
        signedJson.zkappCommand.accountUpdates[i].authorization.signature;
    }
  }
  return transaction;
}

export function serializeTransaction(
  tx: Mina.Transaction<false, false> | Mina.Transaction<false, true>
): string {
  const length = tx.transaction.accountUpdates.length;
  let i;
  const blindingValues = [];
  const forests: ForestSerialized[] = [];
  for (i = 0; i < length; i++) {
    const la = tx.transaction.accountUpdates[i].lazyAuthorization;
    if (
      la !== undefined &&
      (la as any).blindingValue !== undefined &&
      la.kind === "lazy-proof"
    )
      blindingValues.push(la.blindingValue.toJSON());
    else blindingValues.push("");
    const forest: ForestSerialized = { length: 0, items: [] };
    serializeLazyAuthorization(
      (tx.transaction.accountUpdates[i].lazyAuthorization as any)?.args,
      forest
    );
    forests.push(forest);
  }
  const serializedTransaction = JSON.stringify(
    {
      tx: tx.toJSON(),
      blindingValues,
      forestJSONs: forests.map((f) => JSON.stringify(f)),
      length,
      fee: tx.transaction.feePayer.body.fee.toJSON(),
      sender: tx.transaction.feePayer.body.publicKey.toBase58(),
      nonce: tx.transaction.feePayer.body.nonce.toBigint().toString(),
    },
    null,
    2
  );
  return serializedTransaction;
}

function serializeLazyAuthorization(
  lazyAuthorization: any,
  serialized: ForestSerialized
): void {
  if (lazyAuthorization?.hash !== undefined && lazyAuthorization.hash.toJSON) {
    serialized.items.push({
      h: fieldToBase64(lazyAuthorization.hash),
    });
  }

  if (
    lazyAuthorization?.previousHash !== undefined &&
    lazyAuthorization.previousHash.toJSON
  ) {
    serialized.items.push({
      p: fieldToBase64(lazyAuthorization.previousHash),
    });
  }
  if (
    lazyAuthorization?.callData !== undefined &&
    lazyAuthorization.callData.toJSON
  ) {
    serialized.items.push({
      c: fieldToBase64(lazyAuthorization.callData),
    });
  }

  if (lazyAuthorization?.id !== undefined) {
    serialized.items.push({
      i: lazyAuthorization.id,
    });
  }

  if (Array.isArray(lazyAuthorization)) {
    for (const item of lazyAuthorization) {
      serializeLazyAuthorization(item, serialized);
    }
  }
  if (typeof lazyAuthorization === "object") {
    for (const key in lazyAuthorization) {
      serializeLazyAuthorization(lazyAuthorization[key], serialized);
    }
  }
  serialized.length = serialized.items.length;
}

function deserializeLazyAuthorization(
  lazyAuthorization: any,
  serialized: ForestSerialized
): void {
  if (serialized.restoredItems === undefined) serialized.restoredItems = 0;
  if (lazyAuthorization?.hash !== undefined && lazyAuthorization.hash.toJSON) {
    if (serialized.restoredItems >= serialized.length)
      throw new Error("Restored more items than expected");
    const hash = serialized.items[serialized.restoredItems].h;
    if (hash === undefined)
      throw new Error(`Hash is undefined for item ${serialized.restoredItems}`);
    lazyAuthorization.hash = fieldFromBase64(hash);

    serialized.restoredItems++;
  }
  if (
    lazyAuthorization?.previousHash !== undefined &&
    lazyAuthorization.previousHash.toJSON
  ) {
    if (serialized.restoredItems >= serialized.length)
      throw new Error("Restored more items than expected");
    const previousHash = serialized.items[serialized.restoredItems].p;
    if (previousHash === undefined)
      throw new Error(
        `Previous hash is undefined for item ${serialized.restoredItems}`
      );
    lazyAuthorization.previousHash = fieldFromBase64(previousHash);
    serialized.restoredItems++;
  }
  if (
    lazyAuthorization?.callData !== undefined &&
    lazyAuthorization.callData.toJSON
  ) {
    if (serialized.restoredItems >= serialized.length)
      throw new Error("Restored more items than expected");
    const callData = serialized.items[serialized.restoredItems].c;
    if (callData === undefined)
      throw new Error(
        `Call data is undefined for item ${serialized.restoredItems}`
      );
    lazyAuthorization.callData = fieldFromBase64(callData);
    serialized.restoredItems++;
  }
  if (lazyAuthorization?.id !== undefined) {
    if (serialized.restoredItems >= serialized.length)
      throw new Error("Restored more items than expected");
    const id = serialized.items[serialized.restoredItems].i;
    if (id === undefined)
      throw new Error(`Id is undefined for item ${serialized.restoredItems}`);
    lazyAuthorization.id = id;
    serialized.restoredItems++;
  }
  if (Array.isArray(lazyAuthorization)) {
    for (const item of lazyAuthorization) {
      deserializeLazyAuthorization(item, serialized);
    }
  }
  if (typeof lazyAuthorization === "object") {
    for (const key in lazyAuthorization) {
      deserializeLazyAuthorization(lazyAuthorization[key], serialized);
    }
  }
}
