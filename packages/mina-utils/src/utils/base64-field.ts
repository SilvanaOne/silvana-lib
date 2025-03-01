import { Field } from "o1js";
import { toBase, fromBase } from "./base64.js";

// URL friendly base64 encoding
const TABLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function fieldToBase56(field: Field): string {
  const digits = toBase(field.toBigInt(), 56n);
  //console.log("digits:", digits);
  const str = digits.map((x) => TABLE[Number(x)]).join("");
  //console.log("str:", str);
  return str;
}

export function fieldFromBase56(str: string): Field {
  const base56Digits = str.split("").map((x) => BigInt(TABLE.indexOf(x)));
  const x = fromBase(base56Digits, 56n);
  return Field(x);
}

export function fieldToBase64(field: Field): string {
  const digits = toBase(field.toBigInt(), 64n);
  //console.log("digits:", digits);
  const str = digits.map((x) => TABLE[Number(x)]).join("");
  //console.log("str:", str);
  return str;
}

export function fieldFromBase64(str: string): Field {
  const base64Digits = str.split("").map((x) => BigInt(TABLE.indexOf(x)));
  const x = fromBase(base64Digits, 64n);
  return Field(x);
}
