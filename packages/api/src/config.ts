import { client } from "./client/sdk.gen.js";

export function config({
  apiKey,
  chain,
  throwOnError,
}: {
  apiKey: string;
  chain?: "mainnet" | "devnet" | "zeko";
  throwOnError?: boolean;
}) {
  client.setConfig({
    headers: {
      "x-api-key": apiKey,
    },
    baseUrl:
      chain === "zeko"
        ? "https://zekotokens.com/api/v1/"
        : chain === "devnet"
        ? "https://devnet.silvana-one.com/api/v1/"
        : "https://silvana-one.com/api/v1/",
    throwOnError: throwOnError ?? true,
  });
}
