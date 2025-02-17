import { Field, Poseidon, Struct, Experimental, PublicKey, UInt64 } from "o1js";
import { fieldFromString } from "../interfaces/index.js";
import { Text } from "./text.js";
import { MinaAddress } from "./address.js";
import { MetadataTree } from "./tree.js";
export {
  Metadata,
  MetadataMap,
  MetadataFieldType,
  MetadataFieldTypeValues,
  MetadataValue,
  ColorPlugin,
};

/**
 * The height of the metadata Merkle tree.
 */
const METADATA_HEIGHT = 20;
const IndexedMerkleMap = Experimental.IndexedMerkleMap;
type IndexedMerkleMap = Experimental.IndexedMerkleMap;

/**
 * A specialized IndexedMerkleMap for storing metadata.
 */
class MetadataMap extends IndexedMerkleMap(METADATA_HEIGHT) {}

/**
 * The possible types for metadata fields.
 */
type MetadataFieldType =
  | "string"
  | "text"
  | "image"
  | "url"
  | "field" // Field
  | "number" // UInt64
  | "address" // PublicKey
  | "map"
  | "tree";

/**
 * Represents a metadata value with its type and associated data.
 */
class MetadataValue extends Struct({
  value: Field,
  type: Field,
  length: Field,
  height: Field,
}) {
  /**
   * Creates a new MetadataValue instance.
   * @param params - The parameters including value and type.
   * @returns A new MetadataValue.
   */
  static new(params: {
    value: Field | Text | Metadata | MetadataTree | PublicKey | UInt64;
    type: MetadataFieldType;
  }) {
    const { value, type } = params;
    let valueField: Field;
    let length = Field(0);
    let height = Field(0);
    switch (type) {
      case "string":
        if (!(value instanceof Field)) throw new Error(`Invalid value type`);
        valueField = value;
        break;
      case "text":
      case "image":
      case "url":
        if (!(value instanceof Text)) throw new Error(`Invalid value type`);
        valueField = value.root;
        length = Field(value.size);
        height = Field(value.height);
        break;
      case "field":
        if (!(value instanceof Field)) throw new Error(`Invalid value type`);
        valueField = value;
        break;
      case "number":
        if (!(value instanceof UInt64)) throw new Error(`Invalid value type`);
        valueField = value.value;
        break;
      case "address":
        if (!(value instanceof PublicKey))
          throw new Error(`Invalid value type`);
        const address = new MinaAddress(value);
        valueField = address.hash;
        length = Field(2);
        height = Field(0);
        break;
      case "map":
        if (!(value instanceof Metadata)) throw new Error(`Invalid value type`);
        valueField = value.map.root;
        length = Field(value.map.length);
        height = Field(value.map.height);
        break;
      case "tree":
        if (!(value instanceof MetadataTree))
          throw new Error(`Invalid value type`);
        valueField = value.root;
        length = Field(value.values.length);
        height = Field(value.height);
        break;
      default:
        throw new Error(`Unknown value type`);
    }

    return new MetadataValue({
      value: valueField,
      type: Field(MetadataFieldTypeValues[type].code),
      length,
      height,
    });
  }
  /**
   * Computes the Poseidon hash of the metadata value.
   * @returns The hash as a Field.
   */
  hash(): Field {
    return Poseidon.hash(MetadataValue.toFields(this));
  }
}

/**
 * Abstract class for creating custom metadata plugins.
 */
abstract class MetadataPlugin {
  /**
   * The name of the plugin.
   */
  readonly name: string;
  /**
   * Retrieves the trait representation of the metadata value.
   * @param params - The parameters including key, type, value, and isPrivate.
   * @returns An object containing the key, value, and canonical representation.
   */
  abstract getTrait(params: {
    key: string;
    type: string;
    value: unknown;
    isPrivate?: boolean;
  }): {
    key: Field;
    value: MetadataValue;
    canonicalRepresentation: unknown;
  };
  /**
   * Converts the value to JSON.
   * @param value - The value to convert.
   * @returns The JSON representation.
   */
  abstract toJSON(value: unknown): string | object;
  /**
   * Parses the value from JSON.
   * @param value - The JSON value to parse.
   * @returns The parsed value.
   */
  abstract fromJSON(value: string | object): unknown;
}

/**
 * Type representing color values.
 */
type Color = "blue" | "red" | "green" | "yellow" | "purple" | "orange" | "pink";
/**
 * A plugin for handling color metadata.
 */
class ColorPlugin extends MetadataPlugin {
  /**
   * The name of the plugin.
   */
  readonly name = "color";

  /**
   * Converts a color name or value into its numeric representation.
   * @param value - The color value (name, string, or number).
   * @returns The numeric representation of the color.
   */
  getColor(value: Color | string | number): number {
    if (
      typeof value === "string" &&
      ["blue", "red", "green", "yellow", "purple", "orange", "pink"].includes(
        value
      )
    ) {
      const colors: { [key in Color]: number } = {
        blue: 0x0000ff,
        red: 0xff0000,
        green: 0x00ff00,
        yellow: 0xffff00,
        purple: 0x800080,
        orange: 0xffa500,
        pink: 0xffc0cb,
      };
      return colors[value as Color];
    } else if (typeof value === "number") {
      return value;
    } else if (typeof value === "string") {
      try {
        // parse hex color like #0000ff
        return parseInt(value.slice(1), 16);
      } catch (e) {
        throw new Error("Invalid color value");
      }
    }
    throw new Error("Invalid color value");
  }
  /**
   * Retrieves the trait representation of the color value.
   * @param params - The parameters including key, type, and value.
   * @returns An object containing the key, value, and canonical representation.
   */
  getTrait(params: {
    key: string;
    type: string;
    value: Color | string | number;
  }): {
    key: Field;
    value: MetadataValue;
    canonicalRepresentation: number;
  } {
    const { key, value } = params;
    const color = this.getColor(value);
    return {
      key: fieldFromString(key),
      value: new MetadataValue({
        value: Field(color),
        type: Field(10),
        length: Field(0),
        height: Field(0),
      }),
      canonicalRepresentation: color,
    };
  }
  /**
   * Converts the color value to a JSON string.
   * @param value - The color value.
   * @returns The JSON string representation.
   */
  toJSON(value: Color | string | number): string {
    return this.getColor(value).toString(16);
  }
  /**
   * Parses the color value from a JSON string or object.
   * @param value - The JSON value.
   * @returns The numeric representation of the color.
   */
  fromJSON(value: string | object): number {
    if (typeof value !== "string") throw new Error("Invalid color value");
    return this.getColor(parseInt(value, 16));
  }
}

/**
 * Represents the metadata for an NFT, including traits and associated data.
 */
class Metadata {
  /**
   * The underlying map storing the metadata key-value pairs.
   */
  readonly map: MetadataMap;
  /**
   * The name of the NFT.
   */
  readonly name: string;
  /**
   * The image associated with the NFT.
   */
  image: string;
  /**
   * Optional banner image for the NFT.
   */
  banner?: string;
  /**
   * Optional description of the NFT.
   */
  description?: string;
  /**
   * Array of metadata plugins used for custom traits.
   */
  plugins: MetadataPlugin[];
  /**
   * Object containing the traits of the NFT.
   */
  traits: {
    [key: string]: {
      type: string;
      value:
        | string
        | Field
        | Metadata
        | MetadataTree
        | UInt64
        | PublicKey
        | unknown;
      isPrivate: boolean;
    };
  } = {};

  /**
   * Creates a new Metadata instance.
   * @param params - The parameters for the metadata, including name, image, description, banner, and plugins.
   */
  constructor(params: {
    name: string;
    image: string;
    description?: string;
    banner?: string;
    plugins?: MetadataPlugin[];
  }) {
    const { name, description, image, banner, plugins } = params;
    this.plugins = plugins ?? [];
    this.map = new MetadataMap();
    this.addTrait({
      key: "name",
      type: "string",
      value: name,
    });
    this.addTrait({
      key: "image",
      type: "image",
      value: image,
    });
    if (description) {
      this.addTrait({
        key: "description",
        type: "text",
        value: description,
      });
    }
    if (banner) {
      this.addTrait({
        key: "banner",
        type: "image",
        value: banner,
      });
    }
    this.name = name;
    this.image = image;
    this.banner = banner;
    this.description = description;
  }

  /**
   * Adds a trait to the metadata.
   * @param params - The parameters including key, type, value, and isPrivate.
   * @returns An object containing the key and the metadata value.
   */
  addTrait(params: {
    key: string;
    type: string;
    value:
      | string
      | Field
      | Metadata
      | MetadataTree
      | UInt64
      | PublicKey
      | unknown;
    isPrivate?: boolean;
  }): {
    key: Field;
    value: MetadataValue;
  } {
    const { key, type, value, isPrivate = false } = params;
    let keyField = fieldFromString(key);
    let metadataValue: MetadataValue;
    let canonicalRepresentation: unknown = value;

    if (type in MetadataFieldTypeValues) {
      let valueObject:
        | Field
        | Text
        | Metadata
        | MetadataTree
        | UInt64
        | PublicKey;
      switch (type) {
        case "string":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueObject = fieldFromString(value);
          break;
        case "text":
        case "image":
        case "url":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueObject = new Text(value);
          break;
        case "field":
          if (!(value instanceof Field))
            throw new Error(`Invalid trait value type`);
          valueObject = value;
          break;
        case "number":
          if (!(value instanceof UInt64))
            throw new Error(`Invalid trait value type`);
          valueObject = value;
          break;
        case "address":
          if (!(value instanceof PublicKey))
            throw new Error(`Invalid trait value type`);
          valueObject = value;
          break;
        case "map":
          if (!(value instanceof Metadata))
            throw new Error(`Invalid trait value type`);
          valueObject = value;
          break;
        case "tree":
          if (!(value instanceof MetadataTree))
            throw new Error(`Invalid trait value type`);
          valueObject = value;
          break;
        default:
          throw new Error(`Unknown trait value type - internal error`);
      }
      metadataValue = MetadataValue.new({ value: valueObject, type });
    } else {
      const index = this.plugins.findIndex((plugin) => plugin.name === type);
      if (index !== -1) {
        const plugin = this.plugins[index];
        const pluginTrait = plugin.getTrait({ key, type, value, isPrivate });
        metadataValue = pluginTrait.value;
        keyField = pluginTrait.key;
        canonicalRepresentation = pluginTrait.canonicalRepresentation;
      } else throw new Error(`Unknown trait type`);
    }

    this.map.set(keyField, metadataValue.hash());
    this.traits[key] = { type, value: canonicalRepresentation, isPrivate };
    return { key: keyField, value: metadataValue };
  }

  /**
   * Converts the metadata to a JSON representation.
   * @param includePrivateTraits - Whether to include private traits.
   * @returns The JSON representation of the metadata.
   */
  toJSON(includePrivateTraits = false): {
    name: string;
    image: string;
    description?: string;
    banner?: string;
    metadataRoot: string;
    traits: {
      key: string;
      type: string;
      value: string | object;
      isPrivate?: boolean;
    }[];
  } {
    return {
      name: this.name,
      description: this.description,
      image: this.image,
      banner: this.banner,
      metadataRoot: this.map.root.toJSON(),
      traits: Object.entries(this.traits)
        .filter(([_, { isPrivate }]) => includePrivateTraits || !isPrivate)
        .map(([key, { type, value, isPrivate }]) => {
          let jsonValue: string | object;
          switch (type) {
            case "string":
            case "text":
            case "image":
            case "url":
              if (typeof value !== "string")
                throw new Error(`Invalid trait value type`);
              jsonValue = value;
              break;
            case "field":
              if (!(value instanceof Field))
                throw new Error(`Invalid trait value type`);
              jsonValue = value.toJSON();
              break;
            case "number":
              if (!(value instanceof UInt64))
                throw new Error(`Invalid trait value type`);
              jsonValue = value.toJSON();
              break;
            case "address":
              if (!(value instanceof PublicKey))
                throw new Error(`Invalid trait value type`);
              jsonValue = value.toBase58();
              break;
            case "map":
              if (!(value instanceof Metadata))
                throw new Error(`Invalid trait value type`);
              jsonValue = value.toJSON(includePrivateTraits);
              break;
            case "tree":
              if (!(value instanceof MetadataTree))
                throw new Error(`Invalid trait value type`);
              jsonValue = value.toJSON();
              break;
            default:
              const plugin = this.plugins.find(
                (plugin) => plugin.name === type
              );
              if (!plugin) throw new Error(`Unknown trait type`);
              jsonValue = plugin.toJSON(value);
          }
          return {
            key,
            type,
            ...(isPrivate ? { isPrivate } : {}),
            value: jsonValue,
          };
        }),
    };
  }

  /**
   * Constructs a Metadata instance from JSON data.
   * @param params - The parameters including json data, checkRoot flag, and plugins.
   * @returns A new Metadata instance.
   */
  static fromJSON(params: {
    json: {
      name: string;
      image: string;
      description?: string;
      banner?: string;
      metadataRoot: string;
      traits: {
        key: string;
        type: string;
        value: string | object;
        isPrivate?: boolean;
      }[];
    };
    checkRoot?: boolean;
    plugins?: MetadataPlugin[];
  }): Metadata {
    const { json, checkRoot = false, plugins } = params;
    const { name, description, image, banner, metadataRoot, traits } = json;
    if (!name) throw new Error(`Metadata name is required`);
    if (typeof name !== "string") throw new Error(`Invalid metadata name`);
    if (!image || typeof image !== "string")
      throw new Error(`Invalid metadata image`);
    if (description && typeof description !== "string")
      throw new Error(`Invalid metadata description`);
    if (banner && typeof banner !== "string")
      throw new Error(`Invalid metadata banner`);
    if (!metadataRoot || typeof metadataRoot !== "string")
      throw new Error(`Invalid metadata root`);
    if (!traits || !Array.isArray(traits))
      throw new Error(`Metadata traits are required`);
    for (const { key, type, value, isPrivate } of traits) {
      if (!key || typeof key !== "string") throw new Error(`Invalid trait key`);
      if (!type || typeof type !== "string")
        throw new Error(`Invalid trait type`);
      if (!value || (typeof value !== "string" && typeof value !== "object"))
        throw new Error(`Invalid trait value`);
      if (isPrivate && typeof isPrivate !== "boolean")
        throw new Error(`Invalid trait isPrivate`);
    }
    const metadata = new Metadata({
      name,
      description,
      image,
      banner,
      plugins,
    });
    for (const { key, type, value, isPrivate } of traits) {
      let valueField:
        | string
        | Field
        | Metadata
        | MetadataTree
        | UInt64
        | PublicKey
        | unknown;
      switch (type) {
        case "string":
        case "text":
        case "image":
        case "url":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = value;
          break;
        case "field":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = Field.fromJSON(value);
          break;
        case "number":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = UInt64.fromJSON(value);
          break;
        case "address":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = PublicKey.fromBase58(value);
          break;
        case "map":
          if (typeof value !== "object")
            throw new Error(`Invalid trait value type`);
          valueField = Metadata.fromJSON({
            json: value as unknown as {
              name: string;
              image: string;
              description?: string;
              metadataRoot: string;
              traits: {
                key: string;
                type: string;
                value: string | object;
                isPrivate?: boolean;
              }[];
            },
            checkRoot,
          });
          break;
        case "tree":
          if (typeof value !== "object")
            throw new Error(`Invalid trait value type`);
          valueField = MetadataTree.fromJSON(
            value as unknown as {
              height: number;
              root: string;
              values: { key: string; value: string }[];
            }
          );
          break;
        default:
          const plugin = metadata.plugins.find(
            (plugin) => plugin.name === type
          );
          if (!plugin) throw new Error(`Unknown trait type`);
          valueField = plugin.fromJSON(value);
      }
      metadata.addTrait({
        key,
        type,
        value: valueField,
        isPrivate: isPrivate ?? false,
      });
    }
    if (checkRoot === true && metadata.map.root.toJSON() !== metadataRoot) {
      throw new Error(
        `Invalid metadata root:${JSON.stringify(
          {
            params,
            root: metadata.map.root.toJSON(),
            checkRoot,
            metadata: metadata.toJSON(true),
          },
          null,
          2
        )}`
      );
    }

    return metadata;
  }

  /**
   * Constructs a Metadata instance from JSON data.
   * @param params - The parameters including json data, checkRoot flag, and plugins.
   * @returns A new Metadata instance.
   */
  static fromOpenApiJSON(params: {
    json: {
      name: string;
      image: string;
      description?: string;
      banner?: string;
      traits: {
        key: string;
        type: string;
        value: string | object;
        isPrivate?: boolean;
      }[];
    };
    plugins?: MetadataPlugin[];
  }): Metadata {
    const { json, plugins } = params;
    const { name, description, image, banner, traits } = json;
    if (!name) throw new Error(`Metadata name is required`);
    if (typeof name !== "string") throw new Error(`Invalid metadata name`);
    if (!image || typeof image !== "string")
      throw new Error(`Invalid metadata image`);
    if (description && typeof description !== "string")
      throw new Error(`Invalid metadata description`);
    if (banner && typeof banner !== "string")
      throw new Error(`Invalid metadata banner`);
    if (!traits || !Array.isArray(traits))
      throw new Error(`Metadata traits are required`);
    for (const { key, type, value, isPrivate } of traits) {
      if (!key || typeof key !== "string") throw new Error(`Invalid trait key`);
      if (!type || typeof type !== "string")
        throw new Error(`Invalid trait type`);
      if (!value || (typeof value !== "string" && typeof value !== "object"))
        throw new Error(`Invalid trait value`);
      if (isPrivate && typeof isPrivate !== "boolean")
        throw new Error(`Invalid trait isPrivate`);
    }
    const metadata = new Metadata({
      name,
      description,
      image,
      banner,
      plugins,
    });
    for (const { key, type, value, isPrivate } of traits) {
      let valueField:
        | string
        | Field
        | Metadata
        | MetadataTree
        | UInt64
        | PublicKey
        | unknown;
      switch (type) {
        case "string":
        case "text":
        case "image":
        case "url":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = value;
          break;
        case "field":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = Field.fromJSON(value);
          break;
        case "number":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = UInt64.fromJSON(value);
          break;
        case "address":
          if (typeof value !== "string")
            throw new Error(`Invalid trait value type`);
          valueField = PublicKey.fromBase58(value);
          break;
        case "map":
          if (typeof value !== "object")
            throw new Error(`Invalid trait value type`);
          valueField = Metadata.fromOpenApiJSON({
            json: value as unknown as {
              name: string;
              image: string;
              description?: string;
              traits: {
                key: string;
                type: string;
                value: string | object;
                isPrivate?: boolean;
              }[];
            },
          });
          break;
        case "tree":
          if (typeof value !== "object")
            throw new Error(`Invalid trait value type`);
          valueField = MetadataTree.fromJSON(
            value as unknown as {
              height: number;
              root: string;
              values: { key: string; value: string }[];
            }
          );
          break;
        default:
          const plugin = metadata.plugins.find(
            (plugin) => plugin.name === type
          );
          if (!plugin) throw new Error(`Unknown trait type`);
          valueField = plugin.fromJSON(value);
      }
      metadata.addTrait({
        key,
        type,
        value: valueField,
        isPrivate: isPrivate ?? false,
      });
    }

    return metadata;
  }
}

/**
 * Mapping of metadata field types to their code values and associated types.
 */
const MetadataFieldTypeValues = {
  string: { code: 1n, inputType: "string", storedType: Field }, // Field
  text: { code: 2n, inputType: "string", storedType: Text }, // Text
  image: { code: 3n, inputType: "string", storedType: Text }, // Text
  url: { code: 4n, inputType: "string", storedType: Text }, // Text
  field: { code: 5n, inputType: Field, storedType: Field }, // Field
  map: { code: 6n, inputType: Metadata, storedType: Metadata }, // Metadata
  tree: { code: 7n, inputType: MetadataTree, storedType: MetadataTree }, // MetadataTree
  number: { code: 8n, inputType: UInt64, storedType: UInt64 }, // UInt64
  address: { code: 9n, inputType: PublicKey, storedType: MinaAddress }, // MinaAddress
} as const;
