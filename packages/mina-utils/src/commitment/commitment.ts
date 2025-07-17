import { Field, UInt32 } from "o1js";
import { getR, Fr } from "./constants.js";
import { rScalarPowProvable } from "./exp.js";

/// Commitment types and functions
/* 
// Example ZkProgram for commitment update
export const CommitmentProgram = ZkProgram({
  name: "CommitmentUpdate",
  publicOutput: Fr.Canonical.provable,
  methods: {
    updateCommitment: {
      privateInputs: [
        Fr.Canonical.provable, // oldTableCommitment
        Fr.AlmostReduced.provable, // oldStructDigest
        Fr.AlmostReduced.provable, // newStructDigest
        UInt32, // index
      ],
      async method(
        oldTableCommitment: AlmostReducedElement,
        oldStructDigest: AlmostReducedElement,
        newStructDigest: AlmostReducedElement,
        index: UInt32
      ) {
        // Use the provable version of update function
        const newCommitment = update(
          oldTableCommitment,
          oldStructDigest,
          newStructDigest,
          index
        );

        return { publicOutput: newCommitment };
      },
    },
    commitFromScratch: {
      privateInputs: [
        Provable.Array(Fr.Canonical.provable, 2), // struct1 [field0, field1]
        Provable.Array(Fr.Canonical.provable, 2), // struct2 [field0, field1]
      ],
      async method(struct1: CanonicalElement[], struct2: CanonicalElement[]) {
        // Digest each struct
        const c0 = digestStruct(struct1);
        const c1 = digestStruct(struct2);

        // Commit the table of digests
        const commitment = commit([c0, c1]);

        return { publicOutput: commitment };
      },
    },
  },
});
*/

// Use the proper types from the foreign field system
export type CanonicalElement = InstanceType<typeof Fr.Canonical>;
export type AlmostReducedElement = InstanceType<typeof Fr.AlmostReduced>;

// Create R constant for ZkProgram use (needs to be available at module level for provable code)
export const R: CanonicalElement = getR();

// ----- constants taken from Move code (big‑endian hex) -----
export const S: CanonicalElement =
  Fr.from(0x1582695da6689f26db7bb3eb32907ecd0ac3af032aefad31a069352705f0d459n);

const P: Field =
  Field(
    20359658106300430391853594957854653514501797417378649347544016260949017072120n
  );
const P2 = P.mul(P);

// ----- helpers -----
export function scalar(n: bigint): CanonicalElement {
  return Fr.from(n);
}

export function blsCommitment(element: CanonicalElement): Field {
  return element.value[0]
    .add(element.value[1].mul(P))
    .add(element.value[1].mul(P2));
}

// inner: digest one struct
export function digestStruct(fields: CanonicalElement[]): CanonicalElement {
  let d: AlmostReducedElement = Fr.from(0n).assertAlmostReduced();
  for (const f of fields) {
    const prod = d.mul(S); // returns Unreduced
    d = prod.add(f).assertAlmostReduced(); // reduce for next iteration
  }
  return d.assertCanonical();
}

// outer: commit whole table (vector of digests)
export function commit(table: CanonicalElement[]): CanonicalElement {
  let acc: AlmostReducedElement = Fr.from(0n).assertAlmostReduced();
  const r = getR(); // Get R once, not in every iteration

  // Iterate in reverse order so that table[i] gets coefficient R^i
  for (let i = table.length - 1; i >= 0; i--) {
    const prod = acc.mul(r); // returns Unreduced
    acc = prod.add(table[i]).assertAlmostReduced(); // reduce for next iteration
  }
  return acc.assertCanonical();
}

// constant‑time single‑field update using struct digest recalculation (non-provable version)
// export function update(
//   oldTableCommitment: AlmostReducedElement,
//   oldStructDigest: AlmostReducedElement,
//   newStructDigest: AlmostReducedElement,
//   index: number
// ): AlmostReducedElement {
//   // The table commitment formula in commit() now produces:
//   // table[0]*R^0 + table[1]*R^1 + table[2]*R^2 + ... + table[i]*R^i
//   // So position i has coefficient R^i

//   // Position i has coefficient R^i - use optimized lookup table exponentiation
//   const rPowI = rScalarPow(index).assertCanonical();

//   // Calculate the change: new_commitment = old_commitment + (new_struct - old_struct) * R^i
//   const structDelta = newStructDigest
//     .sub(oldStructDigest)
//     .assertAlmostReduced();
//   const tableDelta = structDelta.mul(rPowI).assertAlmostReduced();
//   return oldTableCommitment.add(tableDelta).assertAlmostReduced();
// }

// constant‑time single‑field update using struct digest recalculation (provable version)
export function update(
  oldTableCommitment: CanonicalElement,
  oldStructDigest: AlmostReducedElement,
  newStructDigest: AlmostReducedElement,
  index: UInt32
): CanonicalElement {
  // The table commitment formula in commit() now produces:
  // table[0]*R^0 + table[1]*R^1 + table[2]*R^2 + ... + table[i]*R^i
  // So position i has coefficient R^i

  // Position i has coefficient R^i - use provable lookup table exponentiation
  const rPowI = rScalarPowProvable(index).assertCanonical();

  // Calculate the change: new_commitment = old_commitment + (new_struct - old_struct) * R^i
  const structDelta = newStructDigest
    .sub(oldStructDigest)
    .assertAlmostReduced();
  const tableDelta = structDelta.mul(rPowI).assertAlmostReduced();
  return oldTableCommitment.add(tableDelta).assertCanonical();
}
