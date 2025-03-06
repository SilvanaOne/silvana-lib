import { poseidonUpdate, poseidonInitialState } from "./curve/index.js";

export function poseidon(message: bigint[]): bigint {
  return poseidonUpdate(poseidonInitialState(), message)[0];
}
