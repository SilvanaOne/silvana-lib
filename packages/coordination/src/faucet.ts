"use server";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export async function silvanaFaucet(params: {
  address: string;
  amount?: number;
}): Promise<{
  message: string;
  success: true;
  transaction_hash: string;
}> {
  const { address, amount = 1 } = params;
  const response = await fetch(`${silvanaFaucetEndpoint()}/fund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
      amount,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fund address: ${address} ${amount} ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function silvanaFaucetGetKey(
  params: {
    autoReturn: boolean;
  } = {
    autoReturn: false,
  }
): Promise<{
  key_pair: {
    address: string;
    issued_at: string;
    private_key_bech32: string;
    private_key_hex: string;
    public_key: string;
  };
  message: string;
  success: true;
}> {
  const response = await fetch(`${silvanaFaucetEndpoint()}/get_key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auto_return: params.autoReturn,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get key: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function silvanaFaucetPingKey(params: {
  address: string;
}): Promise<{
  message: string;
  success: boolean;
}> {
  const { address } = params;
  if (!address) {
    return {
      message: "Address is required",
      success: false,
    };
  }
  const response = await fetch(`${silvanaFaucetEndpoint()}/ping_key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to return key: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function silvanaFaucetReturnKey(params: {
  address?: string;
  secretKey?: string;
}): Promise<{
  message: string;
  success: boolean;
}> {
  const address =
    params.address ??
    (params.secretKey
      ? Ed25519Keypair.fromSecretKey(params.secretKey).toSuiAddress()
      : undefined);
  if (!address) {
    return {
      message: "Address or secret key is required",
      success: false,
    };
  }
  const response = await fetch(`${silvanaFaucetEndpoint()}/return_key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to return key: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function silvanaFaucetEndpoint(): string {
  const silvanaFaucetEndpoint = process.env.SILVANA_FAUCET_ENDPOINT!;
  if (!silvanaFaucetEndpoint) {
    throw new Error("SILVANA_FAUCET_ENDPOINT is not set");
  }
  return silvanaFaucetEndpoint;
}
