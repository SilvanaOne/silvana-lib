import { getFullnodeUrl, SuiClient, SuiEvent } from "@mysten/sui/client";
import { namedPackagesPlugin, Transaction } from "@mysten/sui/transactions";

export type SuiNetwork = "testnet" | "devnet" | "localnet" | "mainnet";
export const network: SuiNetwork = (process.env.NEXT_PUBLIC_SUI_CHAIN ||
  process.env.SUI_CHAIN ||
  "testnet") as SuiNetwork;

if (!network) {
  throw new Error("SUI_CHAIN is not set");
}

if (network === "testnet") {
  const plugin = namedPackagesPlugin({
    url: "https://testnet.mvr.mystenlabs.com",
  });
  Transaction.registerGlobalSerializationPlugin("namedPackagesPlugin", plugin);
}

if (network === "mainnet") {
  // TODO: use @mysten/mvr-static
  const plugin = namedPackagesPlugin({
    url: "https://mainnet.mvr.mystenlabs.com",
  });
  Transaction.registerGlobalSerializationPlugin("namedPackagesPlugin", plugin);
}

export const suiClient = new SuiClient({
  url: getUrl(network),
});

function getUrl(network: SuiNetwork) {
  if (network === "testnet") {
    return "https://rpc-testnet.suiscan.xyz:443";
  } else if (network === "devnet") {
    return "https://rpc-ws-devnet.suiscan.xyz";
  } else if (network === "mainnet") {
    return "https://rpc-mainnet.suiscan.xyz:443";
  } else {
    return getFullnodeUrl(network);
  }
}
