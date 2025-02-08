/**
 * Utilities for encoding and decoding `Field` elements to and from strings.
 * These functions are used throughout the NFT standard for handling off-chain storage references and metadata.
 */
import { Encoding, Field } from "o1js";
export { fieldToString, fieldFromString };

/**
 * Converts a `Field` element to a string representation.
 * This is used for serializing `Field` values into strings suitable for storage or transmission.
 *
 * @param {Field} field - The `Field` element to convert.
 * @returns {string} The string representation of the `Field`.
 */
function fieldToString(field: Field): string {
  return Encoding.stringFromFields([field]);
}

/**
 * Reconstructs a `Field` element from its string representation.
 * This function is essential for deserializing strings back into `Field` elements,
 * which can then be used within the smart contract logic.
 *
 * @param {string} storage - The string representation of the `Field`.
 * @returns {Field} The reconstructed `Field` element.
 * @throws Will throw an error if the input string does not correspond to exactly one `Field`.
 */
function fieldFromString(storage: string): Field {
  const fields = Encoding.stringToFields(storage);
  if (fields.length !== 1) throw new Error("String is too long");
  return fields[0];
}
