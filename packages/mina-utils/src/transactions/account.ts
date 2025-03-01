import { fetchMinaAccount } from "../utils/fetch.js";
import { Mina, PublicKey, Field } from "o1js";

export async function accountExists(
  address: string | PublicKey,
  tokenId?: Field
): Promise<boolean> {
  try {
    const publicKey =
      typeof address === "string" ? PublicKey.fromBase58(address) : address;
    await fetchMinaAccount({ publicKey, tokenId, force: false });
    return Mina.hasAccount(publicKey, tokenId);
  } catch (error) {
    return false;
  }
}

export async function tokenBalance(
  address: string | PublicKey,
  tokenId?: Field
): Promise<number | undefined> {
  try {
    const publicKey =
      typeof address === "string" ? PublicKey.fromBase58(address) : address;
    await fetchMinaAccount({ publicKey, tokenId, force: false });
    return Mina.hasAccount(publicKey, tokenId)
      ? Number(Mina.getAccount(publicKey, tokenId).balance.toBigInt())
      : undefined;
  } catch (error) {
    console.error("Cannot fetch account balance", error);
    return undefined;
  }
}

export async function checkAddress(
  address: string | undefined
): Promise<boolean> {
  if (!address || typeof address !== "string") {
    console.error("checkAddress params are invalid:", address);
    return false;
  }
  try {
    const publicKey = PublicKey.fromBase58(address);
    if (address !== publicKey.toBase58()) {
      console.log(
        "checkAddress: address is not valid",
        address,
        publicKey.toBase58()
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("checkAddress catch", { address, error });
    return false;
  }
}
