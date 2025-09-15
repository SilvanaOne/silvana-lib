import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

export interface GeneratedKeypair {
  address: string;
  suiPrivateKey: string;
  keypair: Ed25519Keypair;
}

/**
 * Generates a new Ed25519 keypair
 * @returns Generated keypair with address, and sui private key
 */
export function generateEd25519(): GeneratedKeypair {
  const keypair = new Ed25519Keypair();
  const suiPrivateKey = keypair.getSecretKey();
  const address = keypair.getPublicKey().toSuiAddress();

  return {
    address,
    suiPrivateKey,
    keypair,
  };
}

/**
 * Signs a message with the given secret key
 * @param secretKey - 32-byte secret key as base64 or bech32 string
 * @param message - Message to sign as number[] or Uint8Array
 * @returns Base64-encoded serialized signature string
 */
export async function signMessage(params: {
  secretKey: string;
  message: number[] | Uint8Array;
}): Promise<string> {
  const { secretKey, message } = params;
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);

  // Convert message to Uint8Array if needed
  const messageBytes =
    message instanceof Uint8Array ? message : new Uint8Array(message);

  // Sign the message - this returns just the 64-byte signature
  const signature = await keypair.sign(messageBytes);

  // Get the public key bytes
  const publicKeyBytes = keypair.getPublicKey().toRawBytes();

  // Construct the full Sui signature format: flag || signature || publicKey
  const fullSignature = new Uint8Array(1 + signature.length + publicKeyBytes.length);
  fullSignature[0] = 0x00; // Ed25519 flag
  fullSignature.set(signature, 1);
  fullSignature.set(publicKeyBytes, 1 + signature.length);

  // Return as base64 string (what the SDK expects)
  return toBase64(fullSignature);
}

/**
 * Verifies a signature against an address
 * @param address - Sui address
 * @param message - Original message as number[] or Uint8Array
 * @param signature - Base64-encoded serialized signature string
 * @returns true if signature is valid, false otherwise
 */
export async function verifyWithAddress(
  address: string,
  message: number[] | Uint8Array,
  signature: string
): Promise<boolean> {
  // Convert message to Uint8Array if needed
  const messageBytes =
    message instanceof Uint8Array ? message : new Uint8Array(message);

  try {
    // Decode the base64 signature
    const sigBytes = fromBase64(signature);

    if (sigBytes.length !== 97) {
      return false;
    }

    // Check the flag byte (0x00 for Ed25519)
    if (sigBytes[0] !== 0x00) {
      return false;
    }

    // Extract the public key (last 32 bytes)
    const publicKeyBytes = sigBytes.slice(65, 97);

    // Create an Ed25519PublicKey from the raw bytes
    const publicKey = new Ed25519PublicKey(publicKeyBytes);

    // Verify the derived address matches
    const derivedAddress = publicKey.toSuiAddress();
    if (derivedAddress !== address) {
      return false;
    }

    // Verify the signature using the SDK's expected format (base64 string)
    return await publicKey.verify(messageBytes, signature);
  } catch {
    return false;
  }
}
