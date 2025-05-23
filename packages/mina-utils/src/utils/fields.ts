import { Field, Poseidon } from "o1js";
import { fieldToBase64, fieldFromBase64 } from "./base64-field.js";

/**
 * Serialize fields to a string using base64 URL-friendly encoding
 * @param fields the fields array to serialize
 * @returns the serialized string
 */
export function serializeFields(fields: Field[]): string {
  const hash = Poseidon.hash(fields);
  const value = [Field(fields.length), hash, ...fields];
  //return value.map((f) => f.toBigInt().toString(36)).join(".");
  return value.map((f) => fieldToBase64(f)).join(".");
}

/**
 * Deserialize fields from a string using base64 URL-friendly encoding
 * @param s the string to deserialize
 * @returns the deserialized fields array
 */
export function deserializeFields(s: string): Field[] {
  try {
    //const value = s.split(".").map((n) => Field(BigInt(convert(n, 36))));
    const value = s.split(".").map((n) => fieldFromBase64(n));
    const length = value[0];
    if (
      Field(value.length - 2)
        .equals(length)
        .toBoolean() === false
    )
      throw new Error("deserializeFields: invalid length");
    const hash = Poseidon.hash(value.slice(2));
    if (hash.equals(value[1]).toBoolean()) {
      return value.slice(2);
    } else throw new Error("deserializeFields: invalid hash: data mismatch");
  } catch (e: any) {
    throw new Error(`deserializeFields: invalid string: ${s}: ${e}`);
  }
}
