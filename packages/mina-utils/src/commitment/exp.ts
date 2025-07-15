/// Optimized scalar exponentiation using lookup tables

import {
  getR,
  getTable0Entry,
  getTable1Entry,
  getTable2Entry,
} from "./constants.js";
import { UInt32, Field, Gadgets, Provable, assert } from "o1js";
import {
  WITNESSES0,
  WITNESSES1,
  WITNESSES2,
  TABLE0_ROOT,
  TABLE1_ROOT,
  TABLE2_ROOT,
} from "./witnesses.js";
import { Witness } from "./tree.js";
import { deserializeFields } from "../utils/index.js";
import { blsCommitment, CanonicalElement } from "./commitment.js";
import { Fr } from "./constants.js";

/// Optimized exponentiation using three 1024-element lookup tables
/// Computes R^exp using base-1024 decomposition:
///   exp = i0 + 1024*i1 + 1024^2*i2
///   R^exp = TABLE2[i2] * TABLE1[i1] * TABLE0[i0]
///
/// Time complexity: O(1) - constant time with 3 table lookups + 2 multiplications
/// Space complexity: 3 * 1024 * 32 bytes = 96 KiB for all tables
/// Range: supports exponents up to 1024^3 - 1 = 1,073,741,823
export function rScalarPow(exp: number | bigint): CanonicalElement {
  const expNum = typeof exp === "bigint" ? Number(exp) : exp;

  if (expNum < 0 || expNum >= 1024 ** 3) {
    throw new Error(`Exponent out of range: ${expNum}`);
  }

  // Decompose exponent in base-1024 (10 bits per component)
  const i0 = expNum & 0x3ff; // exp mod 1024 (lowest 10 bits)
  const i1 = (expNum >> 10) & 0x3ff; // next 10 bits
  const i2 = (expNum >> 20) & 0x3ff; // highest 10 bits

  // Constant-time table lookups
  const t0 = getTable0Entry(i0);
  const t1 = getTable1Entry(i1);
  const t2 = getTable2Entry(i2);

  // Combine results with 2 field multiplications
  let result = t2.mul(t1).assertCanonical(); // R^(1024^2*i2 + 1024*i1)
  result = result.mul(t0).assertCanonical(); // + i0

  return result;
}

/// Provable version of scalar exponentiation for use in ZkPrograms
/// Uses o1js gadgets for bitwise operations instead of JavaScript operators
export function rScalarPowProvable(exp: UInt32): CanonicalElement {
  // Range check to ensure exponent is within valid bounds
  assert(
    exp.lessThan(UInt32.from(1024 * 1024 * 1024)),
    "Exponent out of range (non-provable check)"
  );

  // Decompose exponent in base-1024 using provable bitwise operations
  // Each component is 10 bits, so we extract 3 components of 10 bits each

  // Create bitmask for 10 bits (0x3FF = 1023)
  const mask = Field(0x3ff);

  // Extract components using provable bitwise operations
  const i0 = Gadgets.and(exp.value, mask, 10); // exp & 0x3FF (lowest 10 bits)
  const shifted10 = Gadgets.rightShift64(exp.value, 10); // exp >> 10
  const i1 = Gadgets.and(shifted10, mask, 10); // (exp >> 10) & 0x3FF
  const shifted20 = Gadgets.rightShift64(exp.value, 20); // exp >> 20
  const i2 = Gadgets.and(shifted20, mask, 10); // (exp >> 20) & 0x3FF

  // Convert Field indices to witness values for table lookups
  // TODO: use lookup tables instead of witness to make code fully provable
  // or add all TABLEX to Merkle tree and check the value in the tree
  const t0 = Provable.witness(Fr.Canonical.provable, () => {
    const idx = Number(i0.toBigInt());
    return getTable0Entry(idx);
  });
  const witness0 = Provable.witness(Witness, () => {
    const idx = Number(i0.toBigInt());
    return Witness.fromFields(deserializeFields(WITNESSES0[idx]));
  });
  const root0 = Field(TABLE0_ROOT);
  const witness0root = witness0.calculateRoot(blsCommitment(t0));
  const witness0index = witness0.calculateIndex();
  witness0root.assertEquals(root0, "Witness0 root should match root0");
  witness0index.assertEquals(i0, "Witness0 index should match i0");

  const t1 = Provable.witness(Fr.Canonical.provable, () => {
    const idx = Number(i1.toBigInt());
    return getTable1Entry(idx);
  });
  const witness1 = Provable.witness(Witness, () => {
    const idx = Number(i1.toBigInt());
    return Witness.fromFields(deserializeFields(WITNESSES1[idx]));
  });
  const root1 = Field(TABLE1_ROOT);
  const witness1root = witness1.calculateRoot(blsCommitment(t1));
  const witness1index = witness1.calculateIndex();
  witness1root.assertEquals(root1, "Witness1 root should match root1");
  witness1index.assertEquals(i1, "Witness1 index should match i1");

  const t2 = Provable.witness(Fr.Canonical.provable, () => {
    const idx = Number(i2.toBigInt());
    return getTable2Entry(idx);
  });
  const witness2 = Provable.witness(Witness, () => {
    const idx = Number(i2.toBigInt());
    return Witness.fromFields(deserializeFields(WITNESSES2[idx]));
  });
  const root2 = Field(TABLE2_ROOT);
  const witness2root = witness2.calculateRoot(blsCommitment(t2));
  const witness2index = witness2.calculateIndex();
  witness2root.assertEquals(root2, "Witness2 root should match root2");
  witness2index.assertEquals(i2, "Witness2 index should match i2");

  // Combine results with 2 field multiplications
  let result = t2.mul(t1).assertCanonical(); // R^(1024^2*i2 + 1024*i1)
  result = result.mul(t0).assertCanonical(); // + i0

  return result;
}

/// Legacy function (inefficient, use rScalarPow instead)
export function rScalarPowLegacy(exp: number): CanonicalElement {
  let acc = Fr.from(1n); // Start with 1
  const r = getR(); // Get R when needed, not at startup

  for (let i = 0; i < exp; i++) {
    acc = acc.mul(r).assertCanonical();
  }

  return acc;
}
