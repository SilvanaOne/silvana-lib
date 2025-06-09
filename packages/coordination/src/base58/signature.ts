import { MinaSignature } from "../types.js";
import { fromBase58Check, toBase58Check } from "./base58.js";
import { versionNumbers, versionBytes } from "./versions.js";

type NonNegativeInteger<T extends number> = number extends T
  ? never
  : `${T}` extends `-${string}` | `${string}.${string}` | `${string}e-${string}`
  ? never
  : T;

function assertNonNegativeInteger(n: number, message: string) {
  if (!Number.isInteger(n) || n < 0) throw Error(message);
}

function bytesToBigInt(bytes: number[]) {
  let x = 0n;
  let bitPosition = 0n;
  for (let byte of bytes) {
    x += BigInt(byte) << bitPosition;
    bitPosition += 8n;
  }
  return x;
}

function readBytesInternal(bytes: number[], start: number) {
  const rBytes = bytes.slice(start, start + 32);
  const sBytes = bytes.slice(start + 32, start + 64);
  const r = bytesToBigInt(rBytes);
  const s = bytesToBigInt(sBytes);
  return { r, s };
}

function readBytes(bytes: number[], offset: number, versionNumber: number) {
  let version = bytes[offset++];
  if (version !== versionNumber) {
    throw Error(
      `fromBytes: Invalid version byte. Expected ${versionNumber}, got ${version}.`
    );
  }
  return readBytesInternal(bytes, offset);
}

let readBytes_ = <N extends number>(
  bytes: number[],
  offset: NonNegativeInteger<N>
) => {
  assertNonNegativeInteger(offset, "readBytes: offset must be integer >= 0");
  if (offset >= bytes.length)
    throw Error("readBytes: offset must be within bytes length");
  return readBytes(bytes, offset, versionNumbers.signature);
};

function fromBytes(bytes: number[]): MinaSignature {
  return readBytes_(bytes, 0);
}

function toBytes(signature: MinaSignature): number[] {
  const result = new Array<number>(65);
  result[0] = versionNumbers.signature;

  // Convert r to bytes
  let r = signature.r;
  for (let i = 0; i < 32; i++) {
    result[i + 1] = Number(r & 0xffn);
    r >>= 8n;
  }

  // Convert s to bytes
  let s = signature.s;
  for (let i = 0; i < 32; i++) {
    result[i + 33] = Number(s & 0xffn);
    s >>= 8n;
  }

  return result;
}

export function convertMinaSignatureFromBase58(
  signature: string
): MinaSignature {
  const bytes = fromBase58Check(signature, versionBytes.signature);
  const minaSignature = fromBytes(bytes);
  return minaSignature;
}

export function convertMinaSignatureToBase58(signature: MinaSignature): string {
  const bytes = toBytes(signature);
  return toBase58Check(bytes, versionBytes.signature);
}
