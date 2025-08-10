import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import {
  fetchSuiDynamicField,
  fetchSuiDynamicFieldsList,
  fetchSuiObject,
} from "./fetch.js";
import { silvanaRegistryPackage } from "./package.js";

type AgentChain =
  | "ethereum-mainnet"
  | "ethereum-seplolia"
  | "ethereum-holesky"
  | "ethereum-hoodi"
  | "mina-mainnet"
  | "mina-devnet"
  | "zeko-testnet"
  | "zeko-alphanet"
  | "sui-mainnet"
  | "sui-testnet"
  | "sui-devnet"
  | "solana-mainnet"
  | "solana-testnet"
  | "solana-devnet"
  | "solana-devnet"
  | "walrus-mainnet"
  | "walrus-testnet"
  | string; // other chains

export interface AgentMethod {
  dockerImage: string;
  dockerSha256?: string;
  minMemoryGb: number;
  minCpuCores: number;
  requiresTee: boolean;
}

export interface Agent {
  id: string;
  name: string;
  image?: string;
  description?: string;
  site?: string;
  dockerImage: string;
  dockerSha256?: string;
  minMemoryGb: number;
  minCpuCores: number;
  supportsTEE: boolean;
  chains: AgentChain[];
  methods?: Record<string, AgentMethod>;
  defaultMethod?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface Developer {
  id: string;
  name: string;
  github: string;
  image?: string;
  description?: string;
  site?: string;
  owner: string;
  agents: string[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface DeveloperNames {
  id: string;
  developer_address: string;
  names: string[];
  version: number;
}

export class AgentRegistry {
  private readonly registry: string;

  constructor(params: { registry: string }) {
    this.registry = params.registry;
  }

  static createAgentRegistry(params: { name: string }): Transaction {
    console.log("Creating agent registry", params.name);
    const transaction = new Transaction();
    transaction.moveCall({
      target: `${silvanaRegistryPackage}::registry::create_registry`,
      arguments: [transaction.pure.string(params.name)],
    });

    return transaction;
  }

  createDeveloper(params: {
    name: string;
    github: string;
    image?: string;
    description?: string;
    site?: string;
  }): Transaction {
    const { name, github, image, description, site } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::add_developer`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(name),
        tx.pure.string(github),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  updateDeveloper(params: {
    name: string;
    github: string;
    image?: string;
    description?: string;
    site?: string;
  }): Transaction {
    const { name, github, image, description, site } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::update_developer`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(name),
        tx.pure.string(github),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  removeDeveloper(params: { name: string; agentNames: string[] }): Transaction {
    const { name, agentNames } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::remove_developer`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(name),
        tx.pure.vector("string", agentNames),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  createAgent(params: {
    developer: string;
    name: string;
    image?: string;
    description?: string;
    site?: string;
    chains: AgentChain[];
  }): Transaction {
    const {
      developer,
      name,
      image,
      description,
      site,
      chains,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::add_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(name),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.pure.vector("string", chains),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  updateAgent(params: {
    developer: string;
    name: string;
    image?: string;
    description?: string;
    site?: string;
    chains: AgentChain[];
  }): Transaction {
    const {
      developer,
      name,
      image,
      description,
      site,
      chains,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::update_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(name),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.pure.vector("string", chains),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  removeAgent(params: { developer: string; agent: string }): Transaction {
    const { developer, agent } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::remove_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  addAgentMethod(params: {
    developer: string;
    agent: string;
    method: string;
    dockerImage: string;
    dockerSha256?: string;
    minMemoryGb: number;
    minCpuCores: number;
    requiresTee: boolean;
  }): Transaction {
    const {
      developer,
      agent,
      method,
      dockerImage,
      dockerSha256,
      minMemoryGb,
      minCpuCores,
      requiresTee,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::add_method`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.pure.string(method),
        tx.pure.string(dockerImage),
        tx.pure.option("string", dockerSha256 ?? null),
        tx.pure.u16(minMemoryGb),
        tx.pure.u16(minCpuCores),
        tx.pure.bool(requiresTee),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  updateAgentMethod(params: {
    developer: string;
    agent: string;
    method: string;
    dockerImage: string;
    dockerSha256?: string;
    minMemoryGb: number;
    minCpuCores: number;
    requiresTee: boolean;
  }): Transaction {
    const {
      developer,
      agent,
      method,
      dockerImage,
      dockerSha256,
      minMemoryGb,
      minCpuCores,
      requiresTee,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::update_method`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.pure.string(method),
        tx.pure.string(dockerImage),
        tx.pure.option("string", dockerSha256 ?? null),
        tx.pure.u16(minMemoryGb),
        tx.pure.u16(minCpuCores),
        tx.pure.bool(requiresTee),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  removeAgentMethod(params: {
    developer: string;
    agent: string;
    method: string;
  }): Transaction {
    const { developer, agent, method } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::remove_method`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.pure.string(method),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  setDefaultMethod(params: {
    developer: string;
    agent: string;
    method: string;
  }): Transaction {
    const { developer, agent, method } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::set_default_method`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.pure.string(method),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  removeDefaultMethod(params: {
    developer: string;
    agent: string;
  }): Transaction {
    const { developer, agent } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::registry::remove_default_method`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  async getDeveloper(params: { name: string }): Promise<Developer | undefined> {
    const developerObject = await fetchSuiDynamicField({
      objectID: this.registry,
      fieldName: "developers",
      type: "0x1::string::String",
      key: params.name,
    });
    if (!developerObject) {
      return undefined;
    }
    let agents: string[] = [];
    const agentsObject = (developerObject as any)?.agents?.fields?.id?.id;
    if (agentsObject) {
      const agentsList = await fetchSuiDynamicFieldsList(agentsObject);
      const agentsArray = agentsList?.data as any;
      if (Array.isArray(agentsArray)) {
        agents = agentsArray
          .map((agent: any) => agent?.name?.value)
          .filter(
            (agent: any) => agent !== undefined && typeof agent === "string"
          );
      }
    }

    const developer = {
      id: (developerObject as any)?.id?.id,
      name: (developerObject as any).name,
      github: (developerObject as any).github,
      image: (developerObject as any)?.image ?? undefined,
      description: (developerObject as any)?.description ?? undefined,
      site: (developerObject as any)?.site ?? undefined,
      owner: (developerObject as any).owner,
      agents,
      createdAt: Number((developerObject as any).created_at),
      updatedAt: Number((developerObject as any).updated_at),
      version: Number((developerObject as any).version),
    };
    if (
      !developer.id ||
      !developer.name ||
      !developer.github ||
      !developer.owner ||
      !developer.createdAt ||
      !developer.updatedAt
    ) {
      return undefined;
    }
    return developer as Developer;
  }

  async getDeveloperNames(params: {
    developerAddress: string;
  }): Promise<DeveloperNames | undefined> {
    const developerObject = await fetchSuiDynamicField({
      objectID: this.registry,
      fieldName: "developers_index",
      type: "address",
      key: params.developerAddress,
    });
    if (!developerObject) {
      return undefined;
    }
    const developer = {
      id: (developerObject as any)?.id?.id,
      developer_address: (developerObject as any).developer,
      names: (developerObject as any).names,
      version: Number((developerObject as any).version),
    };
    if (!developer.id || !developer.developer_address || !developer.names) {
      return undefined;
    }
    return developer as DeveloperNames;
  }

  async getAgent(params: {
    developer: string;
    agent: string;
  }): Promise<Agent | undefined> {
    const developerObject = await fetchSuiDynamicField({
      objectID: this.registry,
      fieldName: "developers",
      type: "0x1::string::String",
      key: params.developer,
    });

    const id = (developerObject as any)?.agents?.fields?.id?.id;
    if (!id) {
      return undefined;
    }

    const agentObject = await fetchSuiDynamicField({
      parentID: id,
      fieldName: "agents",
      type: "0x1::string::String",
      key: params.agent,
    });
    if (!agentObject) {
      return undefined;
    }
    const agent = {
      id: (agentObject as any)?.id?.id,
      name: (agentObject as any).name,
      image: (agentObject as any)?.image ?? undefined,
      description: (agentObject as any)?.description ?? undefined,
      site: (agentObject as any)?.site ?? undefined,
      dockerImage: (agentObject as any).docker_image,
      dockerSha256: (agentObject as any)?.docker_sha256 ?? undefined,
      minMemoryGb: Number((agentObject as any).min_memory_gb),
      minCpuCores: Number((agentObject as any).min_cpu_cores),
      supportsTEE: Boolean((agentObject as any).supports_tee),
      createdAt: Number((agentObject as any).created_at),
      updatedAt: Number((agentObject as any).updated_at),
      version: Number((agentObject as any).version),
    };
    if (
      !agent.id ||
      !agent.name ||
      !agent.dockerImage ||
      !agent.minMemoryGb ||
      !agent.minCpuCores ||
      !agent.createdAt ||
      !agent.updatedAt
    ) {
      return undefined;
    }
    return agent as Agent;
  }

  static async getDockerImageDetails(params: { dockerImage: string }): Promise<
    | {
        sha256: string;
        numberOfLayers: number;
      }
    | undefined
  > {
    try {
      const { dockerImage } = params;

      // Parse image_source to extract repository and tag
      const colonPos = dockerImage.lastIndexOf(":");
      const repository =
        colonPos !== -1 ? dockerImage.slice(0, colonPos) : dockerImage;
      const tag = colonPos !== -1 ? dockerImage.slice(colonPos + 1) : "latest";

      // 1. Get token
      const tokenResponse = await fetch(
        "https://auth.docker.io/token?" +
          new URLSearchParams({
            service: "registry.docker.io",
            scope: `repository:${repository}:pull`,
          })
      );

      if (!tokenResponse.ok) {
        return undefined;
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      if (!token) {
        return undefined;
      }

      // 2. Fetch manifest/index
      const manifestResponse = await fetch(
        `https://registry-1.docker.io/v2/${repository}/manifests/${tag}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept:
              "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json",
          },
        }
      );

      if (!manifestResponse.ok) {
        return undefined;
      }

      const contentType = manifestResponse.headers.get("content-type") || "";

      // Extract the digest from the response headers
      let digest = manifestResponse.headers.get("docker-content-digest") || "";

      let manifest: any;

      if (contentType.includes("index") || contentType.includes("list")) {
        // This is a manifest index (multi-platform)
        const idx = await manifestResponse.json();

        // Pick amd64/linux manifest
        const platformManifest = idx.manifests?.find(
          (m: any) =>
            m.platform?.architecture === "amd64" && m.platform?.os === "linux"
        );

        if (!platformManifest) {
          return undefined;
        }

        const platformDigest = platformManifest.digest;

        // 3. Fetch the actual manifest
        const actualManifestResponse = await fetch(
          `https://registry-1.docker.io/v2/${repository}/manifests/${platformDigest}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.docker.distribution.manifest.v2+json",
            },
          }
        );

        if (!actualManifestResponse.ok) {
          return undefined;
        }

        manifest = await actualManifestResponse.json();

        // Update digest from the actual manifest response
        const actualDigest = actualManifestResponse.headers.get(
          "docker-content-digest"
        );
        if (actualDigest) {
          digest = actualDigest;
        }
      } else {
        // This is already a direct manifest (single platform)
        manifest = await manifestResponse.json();
      }

      if (!manifest?.layers || !Array.isArray(manifest.layers)) {
        return undefined;
      }

      const numberOfLayers = manifest.layers.length;

      // Remove the "sha256:" prefix if present
      const sha256 = digest.startsWith("sha256:") ? digest.slice(7) : digest;

      if (!sha256) {
        return undefined;
      }

      return {
        sha256,
        numberOfLayers,
      };
    } catch (error) {
      console.error("Error fetching Docker image details:", error);
      return undefined;
    }
  }
}
