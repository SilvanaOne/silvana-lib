import { sha256 } from "js-sha256";
import { changeBase } from "./bigint-helpers.js";

export { fromBase58Check, alphabet };

const alphabet =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".split("");
let inverseAlphabet: Record<string, number> = {};
alphabet.forEach((c, i) => {
  inverseAlphabet[c] = i;
});

export function toBytesWithVersionNumber(t: bigint[], versionNumber: number) {
  let bytes = toBytes(t, versionNumber);
  bytes.unshift(versionNumber);
  return bytes;
}

function bigIntToBytes(x: bigint, length: number) {
  if (x < 0n) {
    throw Error(`bigIntToBytes: negative numbers are not supported, got ${x}`);
  }
  let bytes: number[] = Array(length);
  for (let i = 0; i < length; i++, x >>= 8n) {
    bytes[i] = Number(x & 0xffn);
  }
  if (x > 0n) {
    throw Error(`bigIntToBytes: input does not fit in ${length} bytes`);
  }
  return bytes;
}

function toBytes(t: bigint[], versionNumber: number) {
  if (t.length !== 2) throw new Error("Expected 2 elements in t");

  let bytes: number[] = [];
  /*
  let n = 2;
  for (let i = 0; i < 2; i++) {
    let subBytes = bigIntToBytes(t[i], 32);
    bytes.push(...subBytes);
  }
    */

  let subBytes1 = bigIntToBytes(t[0], 32);
  subBytes1.unshift(versionNumber);
  bytes.push(...subBytes1);
  bytes.push(Number(t[1]));

  return bytes;
}

export function toBase58Check(
  input: number[] | Uint8Array,
  versionByte: number
) {
  let withVersion = [versionByte, ...input];
  let checksum = computeChecksum(withVersion);
  let withChecksum = withVersion.concat(checksum);
  return toBase58(withChecksum);
}

function toBase58(bytes: number[] | Uint8Array) {
  // count the leading zeroes. these get turned into leading zeroes in the output
  let z = 0;
  while (bytes[z] === 0) z++;
  // for some reason, this is big-endian, so we need to reverse
  let digits = [...bytes].map(BigInt).reverse();
  // change base and reverse
  let base58Digits = changeBase(digits, 256n, 58n).reverse();
  // add leading zeroes, map into alphabet
  base58Digits = Array(z).fill(0n).concat(base58Digits);
  return base58Digits.map((x) => alphabet[Number(x)]).join("");
}

function fromBase58Check(base58: string, versionByte: number) {
  // throws on invalid character
  let bytes = fromBase58(base58);
  // check checksum
  let checksum = bytes.slice(-4);
  let originalBytes = bytes.slice(0, -4);
  let actualChecksum = computeChecksum(originalBytes);
  if (!arrayEqual(checksum, actualChecksum))
    throw Error("fromBase58Check: invalid checksum");
  // check version byte
  if (originalBytes[0] !== versionByte)
    throw Error(
      `fromBase58Check: input version byte ${versionByte} does not match encoded version byte ${originalBytes[0]}`
    );
  // return result
  return originalBytes.slice(1);
}

function fromBase58(base58: string) {
  let base58Digits = [...base58].map((c) => {
    let digit = inverseAlphabet[c];
    if (digit === undefined) throw Error("fromBase58: invalid character");
    return BigInt(digit);
  });
  let z = 0;
  while (base58Digits[z] === 0n) z++;
  let digits = changeBase(base58Digits.reverse(), 58n, 256n).reverse();
  digits = Array(z).fill(0n).concat(digits);
  return digits.map(Number);
}

function computeChecksum(input: number[] | Uint8Array) {
  let hash1 = sha256.create();
  hash1.update(input);
  let hash2 = sha256.create();
  hash2.update(hash1.array());
  return hash2.array().slice(0, 4);
}

function arrayEqual(a: unknown[], b: unknown[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
