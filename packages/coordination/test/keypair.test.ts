import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateEd25519,
  signMessage,
  verifyWithAddress,
} from "../src/keypair.js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

describe("Keypair Tests", () => {
  it("should generate a new Ed25519 keypair", () => {
    const keypair = generateEd25519();

    assert(keypair.address, "Should have an address");
    assert(keypair.suiPrivateKey, "Should have a private key");
    assert(keypair.keypair, "Should have a keypair object");

    // Sui addresses should start with 0x and be 66 characters long
    assert(keypair.address.startsWith("0x"), "Address should start with 0x");
    assert.equal(keypair.address.length, 66, "Address should be 66 characters");

    console.log("Generated address:", keypair.address);
  });

  it("should create keypair from secret key", () => {
    const original = generateEd25519();
    const restored = Ed25519Keypair.fromSecretKey(original.suiPrivateKey);

    assert.equal(restored.getPublicKey().toSuiAddress(), original.address, "Addresses should match");
    assert.equal(restored.getSecretKey(), original.suiPrivateKey, "Private keys should match");

    console.log("Successfully restored keypair from secret key");
  });

  it("should sign and verify a message with number[]", async () => {
    const keypair = generateEd25519();
    const message = [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]; // "Hello World"

    // Sign the message
    const signature = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: message,
    });

    assert(typeof signature === "string", "Signature should be a base64 string");

    // Decode to check the format
    const sigBytes = fromBase64(signature);
    assert.equal(sigBytes.length, 97, "Signature should be 97 bytes (flag + sig + pubkey)");
    assert.equal(sigBytes[0], 0x00, "First byte should be 0x00 for Ed25519");

    // Verify the signature
    const isValid = await verifyWithAddress(
      keypair.address,
      message,
      signature
    );

    assert(isValid, "Signature should be valid");
    console.log("Successfully signed and verified message with number[]");
  });

  it("should sign and verify a message with Uint8Array", async () => {
    const keypair = generateEd25519();
    const message = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    // Sign the message
    const signature = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: message,
    });

    assert(typeof signature === "string", "Signature should be a base64 string");
    const sigBytes = fromBase64(signature);
    assert.equal(sigBytes.length, 97, "Signature should be 97 bytes");

    // Verify the signature
    const isValid = await verifyWithAddress(
      keypair.address,
      message,
      signature
    );

    assert(isValid, "Signature should be valid");
    console.log("Successfully signed and verified message with Uint8Array");
  });

  it("should fail verification with wrong address", async () => {
    const keypair1 = generateEd25519();
    const keypair2 = generateEd25519();
    const message = [1, 2, 3, 4, 5];

    // Sign with keypair1
    const signature = await signMessage({
      secretKey: keypair1.suiPrivateKey,
      message: message,
    });

    // Try to verify with keypair2's address
    const isValid = await verifyWithAddress(
      keypair2.address,
      message,
      signature
    );

    assert(!isValid, "Signature should be invalid with wrong address");
    console.log("Correctly rejected signature with wrong address");
  });

  it("should fail verification with wrong message", async () => {
    const keypair = generateEd25519();
    const message1 = [1, 2, 3];
    const message2 = [4, 5, 6];

    // Sign message1
    const signature = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: message1,
    });

    // Try to verify with message2
    const isValid = await verifyWithAddress(
      keypair.address,
      message2,
      signature
    );

    assert(!isValid, "Signature should be invalid with wrong message");
    console.log("Correctly rejected signature with wrong message");
  });

  it("should fail verification with invalid signature format", async () => {
    const keypair = generateEd25519();
    const message = [1, 2, 3];

    // Test with invalid base64
    const isValid1 = await verifyWithAddress(
      keypair.address,
      message,
      "invalid-base64!@#"
    );
    assert(!isValid1, "Should reject invalid base64");

    // Test with wrong length signature
    const invalidSig2 = toBase64(new Uint8Array(50).fill(0));
    const isValid2 = await verifyWithAddress(
      keypair.address,
      message,
      invalidSig2
    );
    assert(!isValid2, "Should reject signature with wrong length");

    // Test with wrong flag byte
    const invalidBytes = new Uint8Array(97).fill(0);
    invalidBytes[0] = 0x01; // Wrong flag
    const invalidSig3 = toBase64(invalidBytes);
    const isValid3 = await verifyWithAddress(
      keypair.address,
      message,
      invalidSig3
    );
    assert(!isValid3, "Should reject signature with wrong flag");

    console.log("Correctly rejected invalid signature formats");
  });

  it("should validate addresses in verification", async () => {
    const keypair = generateEd25519();
    const message = [1, 2, 3];
    const signature = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: message,
    });

    // Valid address format
    const validAddress = "0x" + "a".repeat(64);
    const isValid = await verifyWithAddress(
      validAddress,
      message,
      signature
    );
    assert(!isValid, "Should reject verification with wrong but valid-format address");

    console.log("Address validation in verification working correctly");
  });

  it("should handle conversion between number[] and Uint8Array internally", async () => {
    const keypair = generateEd25519();
    const numbersMessage = [1, 2, 3, 4, 5];
    const uint8Message = new Uint8Array(numbersMessage);

    // Sign with number[]
    const sig1 = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: numbersMessage,
    });

    // Sign with Uint8Array
    const sig2 = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: uint8Message,
    });

    // Both signatures should be the same
    assert.deepEqual(sig1, sig2, "Signatures should match for same message in different formats");

    // Verify both ways
    const valid1 = await verifyWithAddress(keypair.address, numbersMessage, sig1);
    const valid2 = await verifyWithAddress(keypair.address, uint8Message, sig2);

    assert(valid1 && valid2, "Both verifications should succeed");
    console.log("Internal array conversion working correctly");
  });

  it("should handle large messages", async () => {
    const keypair = generateEd25519();
    const largeMessage = new Array(1000).fill(0).map((_, i) => i % 256);

    const signature = await signMessage({
      secretKey: keypair.suiPrivateKey,
      message: largeMessage,
    });

    assert(typeof signature === "string", "Signature should be a base64 string");
    const sigBytes = fromBase64(signature);
    assert.equal(sigBytes.length, 97, "Signature should be 97 bytes");

    const isValid = await verifyWithAddress(
      keypair.address,
      largeMessage,
      signature
    );

    assert(isValid, "Should handle large messages");
    console.log("Successfully handled large message (1000 bytes)");
  });
});

// Run the tests
console.log("Running keypair tests...\n");