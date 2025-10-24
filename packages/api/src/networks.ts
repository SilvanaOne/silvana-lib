export {
  CanonicalBlockchain,
  MinaNetwork,
  networks,
  Mainnet,
  Devnet,
  Zeko,
  ZekoAlphaNet,
  Lightnet,
  Local,
};

type CanonicalBlockchain =
  | "mina:local"
  | "mina:lightnet"
  | "mina:devnet"
  | "mina:mainnet"
  | "zeko:testnet"
  | "zeko:alphanet";

/**
 * blockchain is the type for the chain ID - deprecated.
 */
// type blockchain =
//   | CanonicalBlockchain
//   | "local"
//   | "devnet"
//   | "lightnet"
//   | "mainnet"
//   | "zeko";

// function getCanonicalBlockchain(chain: blockchain): CanonicalBlockchain {
//   switch (chain) {
//     case "local":
//       return "mina:local";
//     case "devnet":
//       return "mina:devnet";
//     case "lightnet":
//       return "mina:lightnet";
//     case "mainnet":
//       return "mina:mainnet";
//     case "zeko":
//       return "zeko:testnet";
//     default:
//       return chain;
//   }
// }

/**
 * MinaNetwork is the data structure for a Mina network, keeping track of the Mina and archive endpoints, chain ID, name, account manager, explorer account URL, explorer transaction URL, and faucet.
 */
interface MinaNetwork {
  /** The Mina endpoints */
  mina: string[];

  /** The archive endpoints */
  archive: string[];

  /** The chain ID */
  chainId: CanonicalBlockchain;

  /** The name of the network (optional) */
  name?: string;

  /** The account manager for Lightnet (optional) */
  accountManager?: string;

  /** The explorer account URL (optional) */
  explorerAccountUrl?: string;

  /** The explorer transaction URL (optional) */
  explorerTransactionUrl?: string;

  /** The explorer token URL (optional) */
  explorerTokenUrl?: string;

  /** The launchpad URL (optional) */
  launchpadUrl?: string;

  /** The faucet URL (optional) */
  faucet?: string;
}

const Mainnet: MinaNetwork = {
  mina: [
    //"https://proxy.devnet.minaexplorer.com/graphql",
    "https://api.minascan.io/node/mainnet/v1/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/mainnet/v1/graphql",
    //"https://archive.devnet.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/mainnet/account/",
  explorerTransactionUrl: "https://minascan.io/mainnet/tx/",
  explorerTokenUrl: "https://minascan.io/mainnet/token/",
  launchpadUrl: "https://minatokens.com",
  chainId: "mina:mainnet",
  name: "Mainnet",
};

const Local: MinaNetwork = {
  mina: [],
  archive: [],
  chainId: "mina:local",
};

const Devnet: MinaNetwork = {
  mina: [
    "https://api.minascan.io/node/devnet/v1/graphql",
    //"https://proxy.devnet.minaexplorer.com/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/devnet/v1/graphql",
    //"https://archive.devnet.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/devnet/account/",
  explorerTransactionUrl: "https://minascan.io/devnet/tx/",
  explorerTokenUrl: "https://minascan.io/devnet/token/",
  launchpadUrl: "https://minatokens.com",
  chainId: "mina:devnet",
  name: "Devnet",
  faucet: "https://faucet.minaprotocol.com",
};

const Zeko: MinaNetwork = {
  mina: ["https://devnet.zeko.io/graphql"],
  archive: ["https://devnet.zeko.io/graphql"],
  explorerAccountUrl: "https://zekoscan.io/testnet/account/",
  explorerTransactionUrl: "https://zekoscan.io/testnet/tx/",
  explorerTokenUrl: "https://zekoscan.io/testnet/token/",
  launchpadUrl: "https://zekotokens.com",
  chainId: "zeko:testnet",
  name: "Zeko",
  faucet: "https://zeko.io/faucet",
};

const ZekoAlphaNet: MinaNetwork = {
  mina: ["http://m1.zeko.io/graphql"],
  archive: ["http://m1.zeko.io/graphql"],
  explorerAccountUrl: "",
  explorerTransactionUrl: "",
  chainId: "zeko:alphanet",
  name: "Zeko AlphaNet",
  faucet: "",
};

const Lightnet: MinaNetwork = {
  mina: ["http://localhost:8080/graphql"],
  archive: ["http://localhost:8282"],
  accountManager: "http://localhost:8181",
  chainId: "mina:lightnet",
  name: "Lightnet",
};

const networks: MinaNetwork[] = [Mainnet, Local, Devnet, Zeko, Lightnet];

/*
// not supported by o1js v1

const Berkeley: MinaNetwork = {
  mina: [
    "https://api.minascan.io/node/berkeley/v1/graphql",
    "https://proxy.berkeley.minaexplorer.com/graphql",
  ],
  archive: [
    "https://api.minascan.io/archive/berkeley/v1/graphql",
    "https://archive.berkeley.minaexplorer.com",
  ],
  explorerAccountUrl: "https://minascan.io/berkeley/account/",
  explorerTransactionUrl: "https://minascan.io/berkeley/tx/",
  chainId: "berkeley",
  name: "Berkeley",
};

const TestWorld2: MinaNetwork = {
  mina: ["https://api.minascan.io/node/testworld/v1/graphql"],
  archive: ["https://archive.testworld.minaexplorer.com"],
  explorerAccountUrl: "https://minascan.io/testworld/account/",
  explorerTransactionUrl: "https://minascan.io/testworld/tx/",
  chainId: "testworld2",
  name: "TestWorld2",
};

*/
