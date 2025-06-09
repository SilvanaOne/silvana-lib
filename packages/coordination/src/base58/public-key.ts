import { toBase58Check, toBytesWithVersionNumber } from "./base58.js";
import { versionNumbers, versionBytes } from "./versions.js";

export function convertFieldsToPublicKey(fields: {
  x: bigint;
  isOdd: boolean;
}): string {
  let bytes = toBytesWithVersionNumber(
    [fields.x, fields.isOdd ? 1n : 0n],
    versionNumbers.publicKey
  );
  return toBase58Check(bytes, versionBytes.publicKey);
}
