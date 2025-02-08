import { MerkleTree, Field } from "o1js";
export { Text, TEXT_TREE_HEIGHT };

/**
 * The default height of the Merkle tree used to represent the text data.
 */
const TEXT_TREE_HEIGHT = 20;

/**
 * The `Text` class represents textual data in the form of a Merkle tree. Each character of the text is converted to its
 * ASCII code and stored as a leaf in the Merkle tree. The root of the tree can be used as a compact representation
 * of the text data in cryptographic proofs.
 */
class Text {
  /**
   * The length of the text.
   */
  readonly size: number;
  /**
   * The original text string.
   */
  readonly text: string;
  /**
   * The root of the Merkle tree representing the text data.
   */
  readonly root: Field;
  /**
   * The height of the Merkle tree.
   */
  readonly height: number;

  /**
   * Constructs a new `Text` instance by creating a Merkle tree from the given text string.
   * Each character in the text is converted to its ASCII code and stored as a leaf in the tree.
   *
   * @param text - The text string to be represented.
   * @param height - The height of the Merkle tree. Defaults to `TEXT_TREE_HEIGHT`.
   * @throws Will throw an error if the text length exceeds the number of leaves in the Merkle tree.
   */
  constructor(text: string, height: number = TEXT_TREE_HEIGHT) {
    this.text = text;
    this.size = text.length;
    const tree = new MerkleTree(height);
    if (this.size > tree.leafCount) throw new Error(`Text is too long`);
    for (let i = 0; i < this.size; i++) {
      tree.setLeaf(BigInt(i), Field.from(this.text.charCodeAt(i)));
    }
    this.root = tree.getRoot();
    this.height = height;
  }

  /**
   * Returns the original text string.
   *
   * @returns The text string.
   */
  public toString(): string {
    return this.text;
  }
}
