import { client } from "./client/client.gen.js";

export function config({
  apiKey,
  chain,
  throwOnError,
}: {
  apiKey: string;
  chain?: "mina:mainnet" | "mina:devnet" | "zeko:testnet";
  throwOnError?: boolean;
}) {
  client.setConfig({
    headers: {
      "x-api-key": apiKey,
    },
    baseUrl:
      chain === "zeko:testnet"
        ? "https://zekotokens.com/api/v1/"
        : chain === "mina:devnet"
        ? "https://devnet.minatokens.com/api/v1/"
        : "https://minatokens.com/api/v1/",
    throwOnError: throwOnError ?? true,
  });
}
