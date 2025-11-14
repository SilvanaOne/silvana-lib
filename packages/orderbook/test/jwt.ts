/**
 * JWT helper functions for integration tests
 *
 * Generates Ed25519-signed JWTs for testing authentication with the orderbook service
 */

import * as ed25519 from '@noble/ed25519';

/**
 * JWT claims structure
 */
interface Claims {
  sub: string;           // Party ID (Canton party ID)
  exp: number;           // Expiration timestamp (Unix seconds)
  iat: number;           // Issued at timestamp (Unix seconds)
  aud: string;           // Audience (e.g., "orderbook-devnet")
  role: string;          // Role: trader, operator, etc.
  markets?: string[];    // Optional: accessible markets
  instruments?: string[]; // Optional: accessible instruments
}

/**
 * Base64url encode (RFC 4648 base64url encoding without padding)
 */
function base64urlEncode(data: Uint8Array): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a JWT token signed with Ed25519
 *
 * @param partyId - The Canton party ID (will be in `sub` claim)
 * @param role - The party role (trader, operator, etc.)
 * @param audience - The JWT audience (e.g., "orderbook-devnet")
 * @param privateKeyHex - The Ed25519 private key as hex string (64 chars / 32 bytes)
 * @param ttlSecs - Time to live in seconds (default: 3600)
 * @returns JWT token string
 */
export async function generateJwt(
  partyId: string,
  role: string,
  audience: string,
  privateKeyHex: string,
  ttlSecs: number = 3600
): Promise<string> {
  // Get current timestamp
  const now = Math.floor(Date.now() / 1000);

  // Create claims
  const claims: Claims = {
    sub: partyId,
    exp: now + ttlSecs,
    iat: now,
    aud: audience,
    role: role,
    markets: [],
    instruments: [],
  };

  // Create JWT header
  const header = {
    typ: 'JWT',
    alg: 'EdDSA',
  };

  // Encode header and claims to base64url
  const headerJson = JSON.stringify(header);
  const claimsJson = JSON.stringify(claims);

  const headerB64 = base64urlEncode(Buffer.from(headerJson));
  const claimsB64 = base64urlEncode(Buffer.from(claimsJson));

  // Create signing input
  const signingInput = `${headerB64}.${claimsB64}`;

  // Parse private key from hex
  const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');

  if (privateKeyBytes.length !== 32) {
    throw new Error(
      `Invalid private key length: expected 32 bytes, got ${privateKeyBytes.length}`
    );
  }

  // Sign with Ed25519
  const signature = await ed25519.signAsync(
    Buffer.from(signingInput),
    privateKeyBytes
  );

  // Encode signature to base64url
  const signatureB64 = base64urlEncode(signature);

  // Combine into JWT
  const jwt = `${headerB64}.${claimsB64}.${signatureB64}`;

  return jwt;
}

/**
 * Load JWT credentials from environment variables
 *
 * @returns Object containing JWT private key and public key
 * @throws Error if required environment variables are not set
 */
export function loadJwtCredentials(): {
  privateKey: string;
  publicKey: string;
} {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey) {
    throw new Error('JWT_PRIVATE_KEY environment variable is not set');
  }

  if (!publicKey) {
    throw new Error('JWT_PUBLIC_KEY environment variable is not set');
  }

  return { privateKey, publicKey };
}

/**
 * Get orderbook gRPC URL from environment
 *
 * @returns The orderbook gRPC URL
 * @throws Error if ORDERBOOK_GRPC_URL environment variable is not set
 */
export function getOrderbookUrl(): string {
  const url = process.env.ORDERBOOK_GRPC_URL;

  if (!url) {
    throw new Error('ORDERBOOK_GRPC_URL environment variable is not set');
  }

  return url;
}
