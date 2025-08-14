import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { silvanaRegistryPackage } from "./package.js";
import { fetchSuiDynamicField, fetchSuiObject } from "./fetch.js";

export type JobStatus = 
  | { type: "Pending" }
  | { type: "Running" }
  | { type: "Failed"; error: string };

export interface Job {
  id: string;
  jobId: number;
  description?: string;
  developer: string;
  agent: string;
  agentMethod: string;
  app: string;
  appInstance: string;
  appInstanceMethod: string;
  sequences?: number[];
  data: Uint8Array;
  status: JobStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateJobParams {
  jobs: string; // Jobs object ID
  description?: string;
  developer: string;
  agent: string;
  agentMethod: string;
  app: string;
  appInstance: string;
  appInstanceMethod: string;
  sequences?: number[];
  data: Uint8Array;
}

export class JobManager {
  private readonly jobs: string;

  constructor(params: { jobs: string }) {
    this.jobs = params.jobs;
  }

  static createJobs(maxAttempts?: number): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::create_jobs`,
      arguments: [
        tx.pure.option("u8", maxAttempts ?? null),
      ],
    });
    return tx;
  }

  createJob(params: CreateJobParams): Transaction {
    const {
      description,
      developer,
      agent,
      agentMethod,
      app,
      appInstance,
      appInstanceMethod,
      sequences,
      data,
    } = params;
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::create_job`,
      arguments: [
        tx.object(this.jobs),
        tx.pure.option("string", description ?? null),
        tx.pure.string(developer),
        tx.pure.string(agent),
        tx.pure.string(agentMethod),
        tx.pure.string(app),
        tx.pure.string(appInstance),
        tx.pure.string(appInstanceMethod),
        tx.pure.option("vector<u64>", sequences ?? null),
        tx.pure.vector("u8", Array.from(data)),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return tx;
  }

  startJob(jobId: number): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::start_job`,
      arguments: [
        tx.object(this.jobs),
        tx.pure.u64(jobId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return tx;
  }

  completeJob(jobId: number): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::complete_job`,
      arguments: [
        tx.object(this.jobs),
        tx.pure.u64(jobId),
      ],
    });
    return tx;
  }

  failJob(params: { jobId: number; error: string }): Transaction {
    const { jobId, error } = params;
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::fail_job`,
      arguments: [
        tx.object(this.jobs),
        tx.pure.u64(jobId),
        tx.pure.string(error),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return tx;
  }

  updateMaxAttempts(maxAttempts: number): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${silvanaRegistryPackage}::jobs::update_max_attempts`,
      arguments: [
        tx.object(this.jobs),
        tx.pure.u64(maxAttempts),
      ],
    });
    return tx;
  }

  async getJob(jobId: number): Promise<Job | undefined> {
    try {
      const jobsObject = await fetchSuiObject(this.jobs);
      if (!jobsObject) return undefined;

      const jobsTableId = (jobsObject as any)?.jobs?.fields?.id?.id;
      if (!jobsTableId) return undefined;

      const job = await fetchSuiDynamicField({
        parentID: jobsTableId,
        fieldName: "jobs",
        type: "u64",
        key: String(jobId),
      });

      if (!job) return undefined;

      const parseStatus = (status: any): JobStatus => {
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
        sequences: (job as any)?.sequences?.map((s: string) => Number(s)) ?? undefined,
        data: new Uint8Array((job as any).data),
        status: parseStatus((job as any).status),
        attempts: Number((job as any).attempts),
        createdAt: Number((job as any).created_at),
        updatedAt: Number((job as any).updated_at),
      };
    } catch (error) {
      console.error("Error fetching job:", error);
      return undefined;
    }
  }

  async getPendingJobs(): Promise<number[]> {
    try {
      const jobsObject = await fetchSuiObject(this.jobs);
      if (!jobsObject) return [];

      const pendingJobs = (jobsObject as any)?.pending_jobs?.fields?.contents;
      if (!Array.isArray(pendingJobs)) return [];

      return pendingJobs.map((id: string) => Number(id));
    } catch (error) {
      console.error("Error fetching pending jobs:", error);
      return [];
    }
  }

  async getNextPendingJob(): Promise<number | undefined> {
    const pendingJobs = await this.getPendingJobs();
    return pendingJobs.length > 0 ? pendingJobs[0] : undefined;
  }

  async getMaxAttempts(): Promise<number> {
    try {
      const jobsObject = await fetchSuiObject(this.jobs);
      if (!jobsObject) return 3; // default value

      return Number((jobsObject as any)?.max_attempts ?? 3);
    } catch (error) {
      console.error("Error fetching max attempts:", error);
      return 3;
    }
  }
}