import { UInt64 } from "o1js";
import config from "../config.js";

/**
 * Calculate the fee for a transaction
 * @returns the fee for a transaction
 */
export async function fee(): Promise<UInt64> {
  //TODO: update after mainnet launch and resolution of the issue https://github.com/o1-labs/o1js/issues/1626
  return UInt64.fromJSON(config.MINAFEE);
}
