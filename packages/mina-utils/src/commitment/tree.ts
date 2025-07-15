import { MerkleTree, MerkleWitness, assert } from "o1js";
import { Fr } from "./constants.js";
import { blsCommitment } from "./commitment.js";

const TREE_DEPTH = 11;
const TABLE_SIZE = 1024;
export class Witness extends MerkleWitness(TREE_DEPTH) {}

export function createMerkleTree(table: bigint[]) {
  assert(table.length === TABLE_SIZE, "Table size must be 1024");
  const tree = new MerkleTree(TREE_DEPTH);
  assert(tree.leafCount === BigInt(TABLE_SIZE), "Tree size must be 1024");

  for (let i = 0; i < TABLE_SIZE; i++) {
    tree.setLeaf(BigInt(i), blsCommitment(Fr.from(table[i])));
  }
  return tree;
}
