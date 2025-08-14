import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { silvanaRegistryPackage } from "./package.js";
import { fetchSuiDynamicField, fetchSuiObject } from "./fetch.js";
import { Job, JobStatus } from "./job.js";

export interface AppMethod {
  description?: string;
  developer: string;
  agent: string;
  agentMethod: string;
}

export interface AppInstance {
  id: string;
  silvanaAppName: string;
  description?: string;
  metadata?: string;
  methods: Record<string, AppMethod>;
  admin: string;
  sequence: number;
  blockNumber: number;
  previousBlockTimestamp: number;
  previousBlockLastSequence: number;
  lastProvedBlockNumber: number;
  isPaused: boolean;
  jobsId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAppJobParams {
  appInstance: string;
  description?: string;
  method: string;
  sequences?: number[];
  data: Uint8Array;
}

export class AppInstanceManager {
  private readonly registry: string;

  constructor(params: { registry: string }) {
    this.registry = params.registry;
  }

  // Note: update_method and remove_method functions are not available in the Move module
  // These would need to be implemented in app_instance.move if needed

  createAppJob(params: CreateAppJobParams): Transaction {
    const { appInstance, description, method, sequences, data } = params;

    // Debug logging
    console.log("createAppJob params:", {
      appInstance,
      description,
      method,
      sequences,
      data:
        data instanceof Uint8Array ? `Uint8Array(${data.length})` : typeof data,
      dataContent: data instanceof Uint8Array ? Array.from(data) : data,
    });

    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::app_instance::create_app_job`,
      arguments: [
        tx.object(appInstance),
        tx.pure.string(method),
        tx.pure.option("string", description ?? null),
        tx.pure.option("vector<u64>", sequences ?? null),
        tx.pure.vector("u8", data),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  startAppJob(params: { appInstance: string; jobId: number }): Transaction {
    const { appInstance, jobId } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::app_instance::start_app_job`,
      arguments: [
        tx.object(appInstance),
        tx.pure.u64(jobId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  completeAppJob(params: { appInstance: string; jobId: number }): Transaction {
    const { appInstance, jobId } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::app_instance::complete_app_job`,
      arguments: [
        tx.object(appInstance), 
        tx.pure.u64(jobId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  failAppJob(params: {
    appInstance: string;
    jobId: number;
    error: string;
  }): Transaction {
    const { appInstance, jobId, error } = params;
    const tx = new Transaction();

    tx.moveCall({
      target: `${silvanaRegistryPackage}::app_instance::fail_app_job`,
      arguments: [
        tx.object(appInstance),
        tx.pure.u64(jobId),
        tx.pure.string(error),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }

  async getAppInstance(
    appInstanceId: string
  ): Promise<AppInstance | undefined> {
    try {
      const appInstance = await fetchSuiObject(appInstanceId);
      if (!appInstance) return undefined;

      const fields = (appInstance as any)?.data?.content?.fields;
      if (!fields) return undefined;

      // Parse methods from VecMap
      const methods: Record<string, AppMethod> = {};
      const methodsArray = fields?.methods?.fields?.contents;
      if (Array.isArray(methodsArray)) {
        for (const entry of methodsArray) {
          const key = entry?.fields?.key;
          const value = entry?.fields?.value;
          if (key && value) {
            // Value might have a fields property too
            const methodFields = value.fields || value;
            methods[key] = {
              description: methodFields.description ?? undefined,
              developer: methodFields.developer,
              agent: methodFields.agent,
              agentMethod: methodFields.agent_method || methodFields.agentMethod,
            };
          }
        }
      }

      return {
        id: fields?.id?.id,
        silvanaAppName: fields.silvana_app_name,
        description: fields?.description ?? undefined,
        metadata: fields?.metadata ?? undefined,
        methods,
        admin: fields.admin,
        sequence: Number(fields.sequence),
        blockNumber: Number(fields.block_number),
        previousBlockTimestamp: Number(fields.previous_block_timestamp),
        previousBlockLastSequence: Number(fields.previous_block_last_sequence),
        lastProvedBlockNumber: Number(fields.last_proved_block_number),
        isPaused: Boolean(fields.isPaused),
        jobsId: String(fields.jobs?.fields?.id?.id ?? ""),
        createdAt: Number(fields.created_at),
        updatedAt: Number(fields.updated_at),
      };
    } catch (error) {
      console.error("Error fetching app instance:", error);
      return undefined;
    }
  }

  async getAppJob(params: {
    appInstance: string;
    jobId: number;
  }): Promise<Job | undefined> {
    try {
      const appInstanceObj = await fetchSuiObject(params.appInstance);
      if (!appInstanceObj) return undefined;

      // Jobs are embedded in the AppInstance - use correct path
      const jobsTableId = (appInstanceObj as any)?.data?.content?.fields?.jobs?.fields?.jobs?.fields?.id?.id;
      if (!jobsTableId) return undefined;

      const job = await fetchSuiDynamicField({
        parentID: jobsTableId,
        fieldName: "jobs",
        type: "u64",
        key: String(params.jobId),
      });

      if (!job) return undefined;

      const parseStatus = (status: any): JobStatus => {
        // Check variant field format (used by Sui dynamic fields)
        if (status?.variant === "Pending") return { type: "Pending" };
        if (status?.variant === "Running") return { type: "Running" };
        if (status?.variant === "Failed") {
          // Get error from fields or from direct property
          const error = status?.fields?.error || status?.fields?.[0] || "Unknown error";
          return { type: "Failed", error };
        }
        // Legacy formats
        if (status?.Pending !== undefined) return { type: "Pending" };
        if (status?.Running !== undefined) return { type: "Running" };
        if (status?.Failed !== undefined) return { type: "Failed", error: status.Failed };
        return { type: "Pending" };
      };

      return {
        id: (job as any)?.id?.id,
        jobId: Number((job as any).job_id),
        description: (job as any)?.description ?? undefined,
        developer: (job as any).developer,
        agent: (job as any).agent,
        agentMethod: (job as any).agent_method,
        app: (job as any).app,
        appInstance: (job as any).app_instance,
        appInstanceMethod: (job as any).app_instance_method,
        sequences:
          (job as any)?.sequences?.map((s: string) => Number(s)) ?? undefined,
        data: new Uint8Array((job as any).data),
        status: parseStatus((job as any).status),
        attempts: Number((job as any).attempts),
        createdAt: Number((job as any).created_at),
        updatedAt: Number((job as any).updated_at),
      };
    } catch (error) {
      console.error("Error fetching app job:", error);
      return undefined;
    }
  }

  async getAppPendingJobs(appInstance: string): Promise<number[]> {
    try {
      const appInstanceObj = await fetchSuiObject(appInstance);
      if (!appInstanceObj) return [];

      // Jobs are embedded in the AppInstance - use correct path
      const pendingJobs = (appInstanceObj as any)?.data?.content?.fields?.jobs?.fields?.pending_jobs?.fields?.contents;
      
      if (!Array.isArray(pendingJobs)) return [];

      return pendingJobs.map((id: string) => Number(id));
    } catch (error) {
      console.error("Error fetching app pending jobs:", error);
      return [];
    }
  }
}
