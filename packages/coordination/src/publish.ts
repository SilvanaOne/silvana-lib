import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Transaction } from "@mysten/sui/transactions";
import { SignatureWithBytes } from "@mysten/sui/cryptography";
import { suiClient } from "./sui-client.js";

export async function buildPublishTx(params: {
  modules: string[];
  dependencies: string[];
  keypair: Secp256k1Keypair;
}): Promise<{
  tx: Transaction;
}> {
  const { modules, dependencies, keypair } = params;
  const address = keypair.toSuiAddress();
  const tx = new Transaction();
  const { Result: publishedDex } = tx.publish({
    modules,
    dependencies,
  });
  const { Result: dex } = tx.transferObjects(
    [
      {
        Result: publishedDex,
      },
    ],
    address
  );
  // const paginatedCoins = await suiClient.getCoins({
  //   owner: address,
  // });
  // const coins = paginatedCoins.data.map((coin) => {
  //   return {
  //     objectId: coin.coinObjectId,
  //     version: coin.version,
  //     digest: coin.digest,
  //   };
  // });
  // console.log("coins", coins);

  tx.setSender(address);
  // tx.setGasOwner(address);
  // tx.setGasPayment(coins);
  //console.log("tx", await tx.toJSON());
  //tx.setGasBudget(300_000_000n);

  //console.log("tx", await tx.toJSON());
  //console.time("sign");
  // const signedTx = await tx.sign({
  //   signer: keypair,
  //   client: suiClient,
  // });
  //console.timeEnd("sign");
  return { tx };
}
