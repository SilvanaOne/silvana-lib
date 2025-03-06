import { Signature, PublicKey } from "./curve/index.js";
import { verify } from "./curve/verify.js";

export function verifySignature(params: {
  data: bigint[];
  signature: Signature;
  publicKey: PublicKey;
}): boolean {
  const { data, signature, publicKey } = params;
  return verify(signature, { fields: data }, publicKey);
}
