import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { fetchSuiDynamicField } from "./fetch.js";

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
  createdAt: number;
  updatedAt: number;
}

export interface Developer {
  id: string;
  name: string;
  github: string;
  image?: string;
  description?: string;
  site?: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
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
      target: `@silvana/agent::registry::create_registry`,
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
      target: `@silvana/agent::registry::add_developer`,
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
      target: `@silvana/agent::registry::update_developer`,
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

  removeDeveloper(params: { name: string }): Transaction {
    const { name } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `@silvana/agent::registry::remove_developer`,
      arguments: [tx.object(this.registry), tx.pure.string(name)],
    });

    return tx;
  }

  createAgent(params: {
    developer: string;
    name: string;
    image?: string;
    description?: string;
    site?: string;
    docker_image: string;
    docker_sha256?: string;
    min_memory_gb: number;
    min_cpu_cores: number;
    supports_tee: boolean;
  }): Transaction {
    const {
      developer,
      name,
      image,
      description,
      site,
      docker_image,
      docker_sha256,
      min_memory_gb,
      min_cpu_cores,
      supports_tee,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `@silvana/agent::registry::add_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(name),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.pure.string(docker_image),
        tx.pure.option("string", docker_sha256 ?? null),
        tx.pure.u16(min_memory_gb),
        tx.pure.u16(min_cpu_cores),
        tx.pure.bool(supports_tee),
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
    docker_image: string;
    docker_sha256?: string;
    min_memory_gb: number;
    min_cpu_cores: number;
    supports_tee: boolean;
  }): Transaction {
    const {
      developer,
      name,
      image,
      description,
      site,
      docker_image,
      docker_sha256,
      min_memory_gb,
      min_cpu_cores,
      supports_tee,
    } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `@silvana/agent::registry::update_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(name),
        tx.pure.option("string", image ?? null),
        tx.pure.option("string", description ?? null),
        tx.pure.option("string", site ?? null),
        tx.pure.string(docker_image),
        tx.pure.option("string", docker_sha256 ?? null),
        tx.pure.u16(min_memory_gb),
        tx.pure.u16(min_cpu_cores),
        tx.pure.bool(supports_tee),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  removeAgent(params: { developer: string; agent: string }): Transaction {
    const { developer, agent } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `@silvana/agent::registry::remove_agent`,
      arguments: [
        tx.object(this.registry),
        tx.pure.string(developer),
        tx.pure.string(agent),
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
    const developer = {
      id: (developerObject as any)?.id?.id,
      name: (developerObject as any).name,
      github: (developerObject as any).github,
      image: (developerObject as any)?.image ?? undefined,
      description: (developerObject as any)?.description ?? undefined,
      site: (developerObject as any)?.site ?? undefined,
      owner: (developerObject as any).owner,
      createdAt: Number((developerObject as any).created_at),
      updatedAt: Number((developerObject as any).updated_at),
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
