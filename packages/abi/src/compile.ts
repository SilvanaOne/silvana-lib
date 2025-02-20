import { Cache, Field } from "o1js";

export type Compilable = {
  compile(options?: { cache: Cache }): Promise<{
    verificationKey: {
      data: string;
      hash: Field;
    };
  }>;
};

export type CompileDependencies = Record<
  /** Transaction type */
  string,
  /** List of contract names */
  string[]
>;
