import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import {
  Mina,
  VerificationKey,
  Field,
  AccountUpdate,
  UInt32,
  Cache,
  UInt64,
  fetchLastBlock,
  PublicKey,
} from "o1js";
import {
  fetchMinaAccount,
  initBlockchain,
  accountBalanceMina,
  accountBalance,
  Memory,
  sendTx,
} from "@silvana-one/mina-utils";
import { TEST_ACCOUNTS } from "./helpers/config.js";
import { BulletinBoard, fieldFromString } from "../src/index.js";
import { Storage } from "@silvana-one/storage";
import { processArguments } from "./helpers/utils.js";
import { randomMetadata } from "./helpers/metadata.js";

let { chain, noLog } = processArguments();
const networkId = chain === "mainnet" ? "mainnet" : "devnet";
const expectedTxStatus = chain === "zeko" ? "pending" : "included";

const { TestPublicKey } = Mina;
type TestPublicKey = Mina.TestPublicKey;

let bbContractVk: VerificationKey;
const cache: Cache = Cache.FileSystem("./cache");
const zkBulletinBoardKey = TestPublicKey.random();

const zkBulletinBoard = new BulletinBoard(zkBulletinBoardKey);
const NUMBER_OF_USERS = 1;
let admin: TestPublicKey;
let user: TestPublicKey;

describe(`Bulletin Board contract tests: ${chain} ${
  noLog ? "noLog" : ""
}`, () => {
  const originalConsoleLog = console.log;
  if (noLog) {
    beforeEach(() => {
      console.log = () => {};
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });
  }

  it("should initialize a blockchain", async () => {
    if (chain === "devnet" || chain === "zeko" || chain === "mainnet") {
      await initBlockchain(chain);
      admin = TestPublicKey.fromBase58(TEST_ACCOUNTS[0].privateKey);
      user = TestPublicKey.fromBase58(TEST_ACCOUNTS[1].privateKey);
    } else if (chain === "local") {
      const { keys } = await initBlockchain(chain, 2);
      admin = TestPublicKey(keys[0].key);
      user = TestPublicKey(keys[1].key);
    } else if (chain === "lightnet") {
      const { keys } = await initBlockchain(chain, 2);
      admin = TestPublicKey(keys[0].key);
      user = TestPublicKey(keys[1].key);
    }
    console.log("chain:", chain);
    console.log("networkId:", Mina.getNetworkId());

    console.log(
      "Bulletin Board contract address:",
      zkBulletinBoardKey.toBase58()
    );

    console.log(
      "Admin  ",
      admin.toBase58(),
      "balance:",
      await accountBalanceMina(admin)
    );
    console.log(
      "User",
      user.toBase58(),
      "balance:",
      await accountBalanceMina(user)
    );

    Memory.info("before compiling");
  });

  it("should compile BulletinBoard Contract", async () => {
    console.log("compiling...");
    console.time("compiled BulletinBoardContract");
    const { verificationKey } = await BulletinBoard.compile({ cache });
    bbContractVk = verificationKey;
    console.timeEnd("compiled BulletinBoardContract");
  });

  it("should deploy a BulletinBoard contract", async () => {
    console.time("deployed BulletinBoard");

    await fetchMinaAccount({ publicKey: admin, force: true });
    const tx = await Mina.transaction(
      {
        sender: admin,
        fee: 100_000_000,
        memo: `Deploy BulletinBoard`,
      },
      async () => {
        AccountUpdate.fundNewAccount(admin, 1);

        await zkBulletinBoard.deploy({
          admin,
        });
        zkBulletinBoard.account.zkappUri.set("NFT BulletinBoard");
      }
    );
    await tx.prove();
    assert.strictEqual(
      (
        await sendTx({
          tx: tx.sign([admin.key, zkBulletinBoardKey.key]),
          description: "deploy BulletinBoard",
        })
      )?.status,
      expectedTxStatus
    );
    console.timeEnd("deployed BulletinBoard");
  });

  it("should send a messages to the BulletinBoard", async () => {
    Memory.info("before send message");
    console.time("send messages");
    const messages = [
      "newCollection",
      "offer",
      "cancelOffer",
      "bid",
      "cancelBid",
      "setFee",
      "sale",
      "withdraw",
      "upgradeVerificationKey",
      "changeAdmin",
    ];
    for (const message of messages) {
      await fetchMinaAccount({ publicKey: user, force: true });
      await fetchMinaAccount({ publicKey: admin, force: true });
      await fetchMinaAccount({ publicKey: zkBulletinBoardKey, force: true });
      const balance = await accountBalance(zkBulletinBoardKey);
      console.log(
        "contract balance before " + message,
        Number(balance.toBigInt() / 1_000_000n) / 1000
      );
      const sender =
        message === "withdraw" ||
        message === "setFee" ||
        message === "upgradeVerificationKey" ||
        message === "changeAdmin"
          ? admin
          : user;
      const collection = TestPublicKey.random();
      const nft = TestPublicKey.random();
      const offer = TestPublicKey.random();
      const buyer = TestPublicKey.random();
      const price = UInt64.from(100_000_000_000);

      const tx = await Mina.transaction(
        {
          sender,
          fee: 100_000_000,
          memo: message,
        },
        async () => {
          switch (message) {
            case "newCollection":
              await zkBulletinBoard.newCollection(collection);
              break;
            case "offer":
              await zkBulletinBoard.offer(collection, nft, offer, price);
              break;
            case "cancelOffer":
              await zkBulletinBoard.cancelOffer(collection, nft);
              break;
            case "bid":
              await zkBulletinBoard.bid(collection, nft, offer, price);
              break;
            case "cancelBid":
              await zkBulletinBoard.cancelBid(collection, nft, offer);
              break;
            case "sale":
              await zkBulletinBoard.sale(collection, nft, buyer, price);
              break;
            case "setFee":
              await zkBulletinBoard.setFee(UInt64.from(200_000_000));
              break;
            case "withdraw":
              await zkBulletinBoard.withdraw(balance);
              break;
            case "upgradeVerificationKey":
              await zkBulletinBoard.upgradeVerificationKey(bbContractVk);
              break;
            case "changeAdmin":
              await zkBulletinBoard.changeAdmin(user);
              break;
          }
        }
      );
      await tx.prove();
      assert.strictEqual(
        (
          await sendTx({
            tx: tx.sign([sender.key]),
            description: message,
          })
        )?.status,
        expectedTxStatus
      );
    }
    console.timeEnd("send messages");
  });
});
