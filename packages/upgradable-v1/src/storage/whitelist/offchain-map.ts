import { Experimental, Struct, Field, Option, Provable, Bool } from "o1js";
import {
  serializeIndexedMap,
  loadIndexedMerkleMap,
  IndexedMapSerialized,
  IndexedMapSerializedJson,
} from "../indexed-map/indexed-map.js";
import { sleep } from "../util/sleep.js";
import { Storage, IpfsHash } from "../storage/storage.js";
import { createIpfsURL } from "../storage/ipfs.js";
import { pinJSON } from "../storage/pinata.js";

const { IndexedMerkleMap } = Experimental;
type IndexedMerkleMap = Experimental.IndexedMerkleMap;
const OFFCHAIN_MAP_HEIGHT = 20;

export interface OffchainMapSerialized extends IndexedMapSerializedJson {
  [key: string]: {
    map: IndexedMapSerialized;
    list: { key: string; value?: string }[];
    data?: object;
  };
}

/** Represents the Offchain Map using an Indexed Merkle Map. */
export class OffchainMap extends IndexedMerkleMap(OFFCHAIN_MAP_HEIGHT) {}
export class OffchainMapOption extends Option(OffchainMap) {}
export class FieldOption extends Option(Field) {}
export interface OffChainMapEntry {
  key: Field | bigint | number | string;
  value?: Field | bigint | number | string; // default is 0
}

/**
 * IpfsHash is used when the map is already pinned to IPFS, it should be string with IPFS hash
 */
export type OffChainMapEntries = OffChainMapEntry[] | IpfsHash;

/**
 * Base class for offchain lists and maps that does not have storage
 */
export class OffChainListBase extends Struct({
  /** The root hash of the Merkle tree representing the whitelist. */
  root: Field,
}) {
  isNone(): Bool {
    return this.root.equals(Field(0));
  }

  isSome(): Bool {
    return this.isNone().not();
  }

  async load(
    storage: Storage,
    name: string = "offchain-map"
  ): Promise<OffchainMapOption> {
    const isNone = this.isNone();
    const map = await Provable.witnessAsync(OffchainMapOption, async () => {
      if (isNone.toBoolean()) return OffchainMapOption.none();
      else
        return OffchainMapOption.fromValue(
          await loadIndexedMerkleMap({
            url: createIpfsURL({ hash: storage.toString() }),
            type: OffchainMap,
            name,
          })
        );
    });
    isNone.assertEquals(map.isSome.not());
    const root = Provable.if(
      map.isSome,
      map.orElse(new OffchainMap()).root,
      Field(0)
    );
    root.equals(this.root);
    return map;
  }

  /**
   * The function fetches a whitelisted amount associated with a given key using a map and returns it
   * as a FieldOption.
   * @param {Field} key - The `key` parameter is of type `Field`,
   * which represents a field element in the context of a cryptographic system.
   * @returns The `getValue` function returns a `Promise` that resolves to a `FieldOption`
   * object. This object contains a `value` property representing the amount retrieved from a map based
   * on the provided key. The `isSome` property indicates whether the value is present or not.
   * The value is not present if the list is NOT empty and the key is NOT in the map.
   * The value is present if the list IS empty or the key IS in the map.
   * The value is present and equals to Field(0) if the list IS empty.
   */
  async getValue(
    key: Field,
    storage: Storage,
    name: string = "offchain-map"
  ): Promise<FieldOption> {
    const map = await this.load(storage, name);
    const value = map.orElse(new OffchainMap()).getOption(key);
    const valueField = value.orElse(Field(0));
    return new FieldOption({
      value: valueField,
      isSome: value.isSome.or(this.isNone()),
    });
  }

  static empty(): OffChainListBase {
    return new OffChainListBase({
      root: Field(0),
    });
  }

  /**
   * Creates a new OffchainListBase
   * @param params - The parameters for creating the list.
   * @param params.list - The list of entries to be added to the map.
   * @param params.data - The JSON data that should be added to the IPFS storage that represent the initial data
   * @returns A new `OffChainList` instance.
   */
  static async create(params: {
    list: OffChainMapEntry[] | { key: string; value?: number }[];
    name?: string;
    data?: object;
  }): Promise<{
    listBase: OffChainListBase;
    json: OffchainMapSerialized;
  }> {
    function toField(
      value: bigint | string | number | Field | undefined
    ): Field {
      if (!value) return Field(0);
      if (typeof value === "string") return Field.fromJSON(value);
      if (typeof value === "bigint" || typeof value === "number")
        return Field(value);
      return value;
    }

    const list = params.list.map((item) => ({
      key: toField(item.key),
      value: toField(item.value),
    }));
    const map = new OffchainMap();
    for (const item of list) {
      map.insert(item.key, item.value);
    }
    const serializedMap = serializeIndexedMap(map);
    const json: OffchainMapSerialized = {
      [params.name ?? "offchain-map"]: {
        map: serializedMap,
        list: list.map((item) => ({
          key: item.key.toJSON(),
          value: item.value?.toJSON(),
        })),
        data: params.data,
      },
    };

    return {
      listBase: new OffChainListBase({
        root: map.root,
      }),
      json,
    };
  }

  toString(): string {
    return JSON.stringify({ root: this.root.toJSON() }, null, 2);
  }

  static fromString(str: string): OffChainListBase {
    const json = JSON.parse(str);
    return new OffChainListBase({
      root: Field.fromJSON(json.root),
    });
  }
}

export class OffChainList extends Struct({
  /** The root hash of the Merkle tree representing the whitelist. */
  root: Field,
  /** Off-chain storage information, typically an IPFS hash pointing to the whitelist data. */
  storage: Storage,
}) {
  isNone(): Bool {
    return this.root.equals(Field(0)).or(this.storage.isEmpty());
  }

  isSome(): Bool {
    return this.isNone().not();
  }

  async load(
    name: string | undefined = "offchain-map"
  ): Promise<OffchainMapOption> {
    const isNone = this.isNone();
    const map = await Provable.witnessAsync(OffchainMapOption, async () => {
      if (isNone.toBoolean()) return OffchainMapOption.none();
      else
        return OffchainMapOption.fromValue(
          await loadIndexedMerkleMap({
            url: createIpfsURL({ hash: this.storage.toString() }),
            type: OffchainMap,
            name,
          })
        );
    });
    isNone.assertEquals(map.isSome.not());
    const root = Provable.if(
      map.isSome,
      map.orElse(new OffchainMap()).root,
      Field(0)
    );
    root.equals(this.root);
    return map;
  }

  /**
   * The function fetches a whitelisted amount associated with a given key using a map and returns it
   * as a FieldOption.
   * @param {Field} key - The `key` parameter is of type `Field`,
   * which represents a field element in the context of a cryptographic system.
   * @returns The `getValue` function returns a `Promise` that resolves to a `FieldOption`
   * object. This object contains a `value` property representing the amount retrieved from a map based
   * on the provided key. The `isSome` property indicates whether the value is present or not.
   * The value is not present if the list is NOT empty and the key is NOT in the map.
   * The value is present if the list IS empty or the key IS in the map.
   * The value is present and equals to Field(0) if the list IS empty.
   */
  async getValue(
    key: Field,
    name: string | undefined = "offchain-map"
  ): Promise<FieldOption> {
    const map = await this.load(name);
    const value = map.orElse(new OffchainMap()).getOption(key);
    const valueField = value.orElse(Field(0));
    return new FieldOption({
      value: valueField,
      isSome: value.isSome.or(this.isNone()),
    });
  }

  static empty(): OffChainList {
    return new OffChainList({
      root: Field(0),
      storage: Storage.empty(),
    });
  }

  /**
   * Creates a new OffchainList
   * and pins it to IPFS.
   * @param params - The parameters for creating the list.
   * @param params.list - The list of entries to be added to the map.
   * @param params.data - The JSON data that should be added to the IPFS storage that represent the initial data
   * @returns A new `OffChainList` instance.
   */
  static async create(params: {
    list: OffChainMapEntry[] | { key: string; value?: number }[];
    data?: object;
    name?: string;
    filename?: string;
    keyvalues?: object;
    timeout?: number;
    attempts?: number;
    auth?: string;
    pin?: boolean;
    json?: OffchainMapSerialized;
  }): Promise<{ list: OffChainList; json: OffchainMapSerialized }> {
    const {
      name = "offchain-map",
      filename = "offchain-list.json",
      keyvalues,
      timeout = 60 * 1000,
      attempts = 5,
      auth,
      pin = true,
      json: initialJson = {},
    } = params;

    const { listBase, json: newJson } = await OffChainListBase.create({
      list: params.list,
      data: params.data,
      name,
    });
    const json = { ...initialJson, ...newJson };

    if (process.env.DEBUG === "true")
      console.log("OffChainList.create:", { json, name, keyvalues });
    if (pin) {
      let attempt = 0;
      const start = Date.now();
      let hash = await pinJSON({
        data: json,
        name: filename,
        keyvalues,
        auth,
      });
      while (!hash && attempt < attempts && Date.now() - start < timeout) {
        attempt++;
        await sleep(5000 * attempt); // handle rate-limits
        hash = await pinJSON({
          data: json,
          name,
          keyvalues,
          auth,
        });
      }
      if (!hash) throw new Error("Failed to pin OffchainMap");
      return {
        list: new OffChainList({
          root: listBase.root,
          storage: Storage.fromString(hash),
        }),
        json,
      };
    }

    return {
      list: new OffChainList({
        root: listBase.root,
        storage: Storage.empty(),
      }),
      json,
    };
  }

  toString(): string {
    return JSON.stringify(
      { root: this.root.toJSON(), storage: this.storage.toString() },
      null,
      2
    );
  }

  static fromString(str: string): OffChainList {
    const json = JSON.parse(str);
    return new OffChainList({
      root: Field.fromJSON(json.root),
      storage: Storage.fromString(json.storage),
    });
  }
}
