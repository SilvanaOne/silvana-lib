export {
  initBlockchain,
  accountBalance,
  accountBalanceMina,
  MinaNetworkInstance,
  currentNetwork,
  getNetworkIdHash,
  getCurrentNetwork,
  getDeployer,
};

import {
  Mina,
  PublicKey,
  PrivateKey,
  UInt64,
  fetchAccount,
  Field,
  Lightnet,
  CircuitString,
} from "o1js";
import {
  networks,
  MinaNetwork,
  Local,
  CanonicalBlockchain,
} from "@silvana-one/api";

/**
 * MinaNetworkInstance is the data structure for a Mina network instance, keeping track of the keys, network, and network ID hash.
 */
interface MinaNetworkInstance {
  /** The keys for the deployers */
  keys: Mina.TestPublicKey[];

  /** The network */
  network: MinaNetwork;

  /** The network ID hash */
  networkIdHash: Field;
}

let currentNetwork: MinaNetworkInstance | undefined = undefined;

function getNetworkIdHash(): Field {
  if (currentNetwork === undefined) {
    throw new Error("Network is not initialized");
  }
  return currentNetwork.networkIdHash;
}

function getCurrentNetwork(): MinaNetworkInstance {
  if (currentNetwork === undefined) {
    throw new Error("Network is not initialized");
  }
  return currentNetwork;
}

function getDeployer(): Mina.TestPublicKey | undefined {
  if (currentNetwork === undefined) {
    throw new Error("Network is not initialized");
  }
  if (currentNetwork.keys.length < 1) return undefined;
  return currentNetwork.keys[0];
}

/**
 * Initializes the Mina blockchain network
 * Due to the limitations of the Mina SDK, only one network can be initialized at a time
 * This function should be called before any other Mina functions
 * @param instance the blockchain instance to initialize
 * @param deployersNumber the number of deployers to use for the network (only for local and lightnet networks)
 * @returns the Mina network instance
 */
async function initBlockchain(params: {
  chain: CanonicalBlockchain;
  deployersNumber?: number;
  proofsEnabled?: boolean;
  customMinaNodeUrl?: string;
  customMinaArchiveNodeUrl?: string;
}): Promise<MinaNetworkInstance> {
  const {
    chain,
    deployersNumber = 0,
    proofsEnabled = true,
    customMinaNodeUrl = undefined,
    customMinaArchiveNodeUrl = undefined,
  } = params;
  if (currentNetwork !== undefined) {
    if (currentNetwork?.network.chainId === chain) {
      return currentNetwork;
    } else {
      throw new Error(
        `Network is already initialized to different chain ${currentNetwork.network.chainId}, cannot initialize to ${chain}`
      );
    }
  }
  const networkIdHash = CircuitString.fromString(chain).hash();

  // await used for compatibility with future versions of o1js
  if (chain === "mina:local") {
    const local = await Mina.LocalBlockchain({
      proofsEnabled,
    });
    Mina.setActiveInstance(local);
    if (deployersNumber > local.testAccounts.length)
      throw new Error("Not enough test accounts");
    currentNetwork = {
      keys: local.testAccounts,
      network: Local,
      networkIdHash,
    };
    return currentNetwork;
  }

  const network = networks.find((n) => n.chainId === chain);
  if (network === undefined) {
    throw new Error("Unknown network");
  }
  const mina =
    process.env.MINA_NODE_URL ??
    process.env.NEXT_PUBLIC_MINA_NODE_URL ??
    customMinaNodeUrl ??
    network.mina;
  const archive =
    process.env.MINA_ARCHIVE_NODE_URL ??
    process.env.NEXT_PUBLIC_MINA_ARCHIVE_NODE_URL ??
    customMinaArchiveNodeUrl ??
    network.archive;
  console.log("mina endpoint:", mina);
  console.log("archive endpoint:", archive);

  const networkInstance = Mina.Network({
    mina,
    archive,
    lightnetAccountManager: network.accountManager,
    networkId: chain === "mina:mainnet" ? "mainnet" : "testnet",
    bypassTransactionLimits:
      chain === "zeko:testnet" || chain === "zeko:alphanet",
  });
  Mina.setActiveInstance(networkInstance);

  const keys: Mina.TestPublicKey[] = [];

  if (deployersNumber > 0) {
    if (chain === "mina:lightnet") {
      for (let i = 0; i < deployersNumber; i++) {
        const keyPair = await Lightnet.acquireKeyPair();
        const key = Mina.TestPublicKey(keyPair.privateKey);
        keys.push(key);
      }
    } else {
      const deployers = process.env.DEPLOYERS;
      if (
        deployers === undefined ||
        Array.isArray(deployers) === false ||
        deployers.length < deployersNumber
      )
        throw new Error("Deployers are not set");
      for (let i = 0; i < deployersNumber; i++) {
        const privateKey = PrivateKey.fromBase58(deployers[i]);
        const key = Mina.TestPublicKey(privateKey);
        keys.push(key);
      }
    }
  }

  currentNetwork = {
    keys,
    network,
    networkIdHash,
  };
  return currentNetwork;
}

/**
 * Fetches the account balance for a given public key
 * @param address the public key
 * @returns the account balance
 */
async function accountBalance(address: PublicKey): Promise<UInt64> {
  await fetchAccount({ publicKey: address });
  if (Mina.hasAccount(address)) return Mina.getBalance(address);
  else return UInt64.from(0);
}

/**
 * Fetches the account balance for a given public key and returns it in Mina
 * @param address the public key
 * @returns the account balance in MINA
 */
async function accountBalanceMina(address: PublicKey): Promise<number> {
  return Number((await accountBalance(address)).toBigInt()) / 1e9;
}
