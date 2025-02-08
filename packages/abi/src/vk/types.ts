export type ChainVerificationKeysList = {
  o1js: string;
  vk: Record<
    string, // contract name
    {
      hash: string;
      data: string;
      type: "token" | "admin" | "upgrade" | "user" | "nft" | "collection";
    }
  >;
};

export type VerificationKeysList = Record<
  "mainnet" | "devnet",
  ChainVerificationKeysList
>;
