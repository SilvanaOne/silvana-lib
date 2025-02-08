// This script will run out of memory first time, just run it three times
import { it } from "node:test";
import assert from "node:assert";
import { Mina, VerificationKey, Field, Cache } from "o1js";
import {
  FungibleToken,
  FungibleTokenAdmin,
  AdvancedFungibleToken,
  FungibleTokenAdvancedAdmin,
  FungibleTokenBidContract,
  FungibleTokenOfferContract,
  FungibleTokenClaimContract,
  FungibleTokenBondingCurveAdmin,
  BondingCurveFungibleToken,
} from "@silvana-one/token";
import {
  NFT,
  Collection,
  AdvancedCollection,
  NFTAdmin,
  NFTAdvancedAdmin,
  Approval,
} from "@silvana-one/nft";
import {
  tokenVerificationKeys,
  ChainVerificationKeysList,
} from "@silvana-one/abi";
import { VerificationKeyUpgradeAuthority } from "@silvana-one/upgradable";
import fs from "fs/promises";

import { FungibleTokenAdmin as FungibleTokenAdminMF } from "./FungibleTokenAdmin.js";
import { FungibleToken as FungibleTokenMF } from "./FungibleToken.js";

let o1jsVersion: string;
let isDifferent = false;

type CompilableInternal = {
  name: string;
  compile({ cache }: { cache: Cache }): Promise<{
    verificationKey: {
      data: string;
      hash: Field;
    };
  }>;
  analyzeMethods(): Promise<
    Record<
      string,
      {
        rows: number;
      }
    >
  >;
};

const contracts: {
  name: string;
  contract: CompilableInternal;
  type: "token" | "admin" | "upgrade" | "user" | "check" | "nft" | "collection";
}[] = [
  { name: "NFT", contract: NFT, type: "nft" },
  {
    name: "Collection",
    contract: Collection as unknown as CompilableInternal,
    type: "collection",
  },
  {
    name: "NonFungibleTokenOfferContract",
    contract: Approval as unknown as CompilableInternal,
    type: "user",
  },
  { name: "NFTAdmin", contract: NFTAdmin, type: "admin" },
  {
    name: "VerificationKeyUpgradeAuthority",
    contract: VerificationKeyUpgradeAuthority,
    type: "upgrade",
  },
  { name: "NFTAdvancedAdmin", contract: NFTAdvancedAdmin, type: "admin" },

  {
    name: "AdvancedCollection",
    contract: AdvancedCollection as unknown as CompilableInternal,
    type: "collection",
  },

  { name: "FungibleToken", contract: FungibleToken, type: "token" },
  {
    name: "BondingCurveFungibleToken",
    contract: BondingCurveFungibleToken,
    type: "token",
  },
  {
    name: "FungibleTokenBondingCurveAdmin",
    contract: FungibleTokenBondingCurveAdmin,
    type: "admin",
  },
  { name: "FungibleTokenAdmin", contract: FungibleTokenAdmin, type: "admin" },
  {
    name: "AdvancedFungibleToken",
    contract: AdvancedFungibleToken,
    type: "token",
  },
  {
    name: "FungibleTokenAdvancedAdmin",
    contract: FungibleTokenAdvancedAdmin,
    type: "admin",
  },
  {
    name: "FungibleTokenBidContract",
    contract: FungibleTokenBidContract,
    type: "user",
  },
  {
    name: "FungibleTokenOfferContract",
    contract: FungibleTokenOfferContract,
    type: "user",
  },
  {
    name: "FungibleTokenClaimContract",
    contract: FungibleTokenClaimContract,
    type: "user",
  },
  {
    name: "FungibleTokenAdminMF",
    contract: FungibleTokenAdminMF,
    type: "check",
  },
  { name: "FungibleTokenMF", contract: FungibleTokenMF, type: "check" },
];

const verificationKeys: { name: string; verificationKey: VerificationKey }[] =
  [];

export async function compileContracts(chain: string) {
  const networkId = chain === "mainnet" ? "mainnet" : "devnet";

  const cache: Cache = Cache.FileSystem(
    networkId === "mainnet" ? "./cache/mainnet" : "./cache"
  );

  await it("should initialize a blockchain", async () => {
    const networkInstance = Mina.Network({
      mina: [],
      archive: [],
      networkId: networkId === "mainnet" ? "mainnet" : "testnet", // TODO: change to devnet after o1js update
    });
    Mina.setActiveInstance(networkInstance);
    console.log("chain:", chain);
    console.log("networkId:", Mina.getNetworkId());
    o1jsVersion = JSON.parse(
      await fs.readFile("./node_modules/o1js/package.json", "utf8")
    ).version;
    console.log(`o1js version:`, o1jsVersion);
    for (const contract of contracts) {
      console.log(`${contract.name} contract:`, contract.contract.name);
    }
  });

  await it("should analyze methods", async () => {
    console.log("Analyzing contracts methods...");
    console.time("methods analyzed");
    const methods: any[] = [];
    for (const contract of contracts) {
      methods.push({
        name: contract.name,
        result: await contract.contract.analyzeMethods(),
        skip: true,
      });
    }
    console.timeEnd("methods analyzed");
    const maxRows = 2 ** 16;
    for (const contract of methods) {
      // calculate the size of the contract - the sum or rows for each method
      const size = Object.values(contract.result).reduce(
        (acc, method) => acc + (method as any).rows,
        0
      ) as number;
      // calculate percentage rounded to 0 decimal places
      const percentage = Math.round(((size * 100) / maxRows) * 100) / 100;

      console.log(
        `method's total size for a ${contract.name} is ${size} rows (${percentage}% of max ${maxRows} rows)`
      );
      if (contract.skip !== true)
        for (const method in contract.result) {
          console.log(method, `rows:`, (contract.result as any)[method].rows);
        }
    }
  });

  await it("should compile", async () => {
    console.log("compiling...");
    for (const contract of contracts) {
      console.time(`compiled ${contract.name}`);
      const { verificationKey } = await contract.contract.compile({ cache });
      verificationKeys.push({ name: contract.name, verificationKey });
      console.timeEnd(`compiled ${contract.name}`);
      const rss = process.memoryUsage().rss;
      if (rss > 1024 * 1024 * 5000)
        console.log(`RSS memory: ${Math.round(rss / 1024 / 1024)} MB`);
    }
  });

  await it("should compare verification keys with MF versions", async () => {
    const sets = [
      { name: "FungibleToken", MF_name: "FungibleTokenMF" },
      { name: "BondingCurveFungibleToken", MF_name: "FungibleTokenMF" },
      { name: "AdvancedFungibleToken", MF_name: "FungibleTokenMF" },
      { name: "FungibleTokenAdmin", MF_name: "FungibleTokenAdminMF" },
    ];
    for (const set of sets) {
      const verificationKey = verificationKeys.find(
        (vk) => vk.name === set.name
      )?.verificationKey;
      const MF_verificationKey = verificationKeys.find(
        (vk) => vk.name === set.MF_name
      )?.verificationKey;
      if (!verificationKey) {
        console.error(`Verification key for ${set.name} not found`);
      }
      if (!MF_verificationKey) {
        console.error(`Verification key for ${set.MF_name} not found`);
      }
      assert(
        verificationKey?.hash.toJSON() === MF_verificationKey?.hash.toJSON()
      );
      assert(verificationKey?.data === MF_verificationKey?.data);
    }
  });

  await it("should verify the verification keys", async () => {
    for (const contract of contracts) {
      const verificationKey = verificationKeys.find(
        (vk) => vk.name === contract.name
      )?.verificationKey;
      const recordedVerificationKey =
        tokenVerificationKeys[networkId]["vk"][contract.name];
      if (!verificationKey) {
        console.error(`Verification key for ${contract.name} not found`);
      }
      if (!recordedVerificationKey) {
        if (contract.type !== "check") {
          console.error(
            `Recorded verification key for ${contract.name} not found`
          );
          isDifferent = true;
        }
      } else if (
        verificationKey?.hash.toJSON() !== recordedVerificationKey?.hash
      ) {
        console.error(`Verification key for ${contract.name} is different`);
        isDifferent = true;
      }
      if (
        verificationKey?.data !== recordedVerificationKey?.data &&
        contract.type !== "check"
      ) {
        console.error(
          `Verification key data for ${contract.name} is different`
        );
        isDifferent = true;
      }
    }
    //assert(!isDifferent);
  });

  await it("should save new verification keys", async () => {
    //isDifferent = true;
    if (isDifferent) {
      console.log("\x1b[31msaving new verification keys\x1b[0m");
      let vk: ChainVerificationKeysList = {
        o1js: o1jsVersion,
        vk: contracts
          .filter((c) => c.type !== "check")
          .reduce(
            (acc, c) => ({
              ...acc,
              [c.name]: {
                hash: (c.contract as any)._verificationKey.hash.toJSON(),
                data: (c.contract as any)._verificationKey.data,
                type: c.type,
              },
            }),
            {}
          ),
      };

      // let contractList = contracts
      //   .filter((c) => c.type !== "check")
      //   .reduce(
      //     (acc, c) => ({
      //       ...acc,
      //       [c.name]: "ContractStart" + c.name + "ContractEnd",
      //     }),
      //     {}
      //   );

      // const json: any = {};
      // json[networkId] = vk;
      // const contractsString = JSON.stringify({ contractList }, null, 2)
      //   .replace(/"ContractStart/g, "")
      //   .replace(/ContractEnd"/g, "");
      // const vkString = JSON.stringify(json, null, 2);

      // await fs.writeFile(
      //   `./vk/${networkId}-verification-keys.json`,
      //   `${vkString}\n\n${contractsString}`
      // );
      const vkString =
        `// This file is generated by the compile script. Do not edit it manually.
import { ChainVerificationKeysList } from "./types.js";

export const ${networkId}: ChainVerificationKeysList =  ` +
        JSON.stringify(vk, null, 2) +
        ";\n\n";

      await fs.writeFile(`./packages/abi/src/vk/${networkId}.ts`, vkString);
    } else {
      console.log("\x1b[32mVerification keys are up to date\x1b[0m");
    }
  });
}

async function main() {
  const chain = process.env.CHAIN;
  if (!chain || !["mainnet", "devnet"].includes(chain)) {
    console.error(
      "Please provide a chain argument: mainnet or devnet. Received:",
      chain
    );
    process.exit(1);
  } else {
    try {
      await compileContracts(chain);
    } catch (error) {
      console.error("Error compiling contracts:", error);
      process.exit(1);
    }
  }
}

main();
