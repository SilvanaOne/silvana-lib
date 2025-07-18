import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Transaction, UpgradePolicy } from "@mysten/sui/transactions";
import { suiClient } from "./sui-client.js";

export async function buildUpgradeTx(params: {
  modules: string[];
  dependencies: string[];
  digest: number[];
  address: string;
  keypair: Secp256k1Keypair;
  packageID: string;
  upgradeCap: string;
}): Promise<{
  tx: Transaction;
}> {
  const {
    modules,
    dependencies,
    digest,
    address,
    keypair,
    packageID,
    upgradeCap,
  } = params;
  const tx = new Transaction();
  const ticket = tx.moveCall({
    target: "0x2::package::authorize_upgrade",
    arguments: [
      tx.object(upgradeCap),
      tx.pure.u8(UpgradePolicy.COMPATIBLE),
      tx.pure.vector("u8", digest),
    ],
  });
  const upgradeData = tx.upgrade({
    package: packageID,
    ticket,
    modules,
    dependencies,
  });
  const commitData = tx.moveCall({
    target: "0x2::package::commit_upgrade",
    arguments: [tx.object(upgradeCap), upgradeData],
  });
  const paginatedCoins = await suiClient.getCoins({
    owner: address,
  });
  const coins = paginatedCoins.data.map((coin) => {
    return {
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    };
  });

  tx.setSender(address);
  tx.setGasOwner(address);
  tx.setGasPayment(coins);
  tx.setGasBudget(300_000_000);

  return { tx };
}
