import {
  Signature,
  PublicKey,
  Group,
  publicKeyToGroup,
  sub,
  scale,
  isEven,
  equal,
} from "./curve.js";
import { hashMessage } from "./hash.js";
import { PallasConstants } from "./constants.js";

export function verify(
  signature: Signature,
  message: { fields: bigint[] },
  publicKey: PublicKey
) {
  const { r, s } = signature;
  const pk = publicKeyToGroup(publicKey);
  const e = hashMessage(message, pk, r);
  const { one } = PallasConstants;
  const R = sub(scale(one, s), scale(Group.toProjective(pk), e));
  try {
    // if `R` is infinity, Group.fromProjective throws an error, so `verify` returns false
    const { x: rx, y: ry } = Group.fromProjective(R);
    return isEven(ry) && equal(rx, r);
  } catch {
    return false;
  }
}
