import chalk from "chalk";
import { sleep } from "@silvana-one/mina-utils";
import { LocalCloud, LocalStorage } from "../local/local.js";
import { zkCloudWorker, Cloud, JobData, config } from "@silvana-one/prover";
import { CanonicalBlockchain } from "@silvana-one/api";
const { ZKCLOUDWORKER_AUTH, ZKCLOUDWORKER_API } = config;

/**
 * The APICommand type for interacting with the zkCloudWorker
 * @typedef { "recursiveProof" | "execute" | "sendTransactions" | "jobResult" | "deploy" | "getBalance" | "queryBilling" } ApiCommand
 * @property recursiveProof The command for the recursiveProof calculation
 * @property execute The command for the execute function call (sync or async)
 * @property sendTransactions The command for sending transactions to the cloud
 * @property jobResult The command for getting the result of the job
 * @property deploy The command for deploying the code to the cloud, it is recommended use CLI tools for deployment
 * @property getBalance The command for getting the balance of the user's account with zkCloudWorker
 * @property queryBilling The command for getting the billing report of the user's account with zkCloudWorker
 */
export type ApiCommand =
  | "recursiveProof"
  | "execute"
  | "sendTransactions"
  | "jobResult"
  | "deploy"
  | "getBalance"
  | "queryBilling";

/**
 * API class for interacting with the zkCloudWorker
 * @property jwt The jwt token for authentication, get it at https://t.me/minanft_bot?start=auth
 * @property endpoint The endpoint of the serverless api
 * @property chain The blockchain network to use
 * @property webhook The webhook for the serverless api to get the results
 * @property localWorker The local worker for the serverless api to test the code locally
 */
export class zkCloudWorkerClient {
  readonly jwt: string;
  readonly endpoint?: string;
  readonly chain: CanonicalBlockchain;
  readonly webhook?: string;
  readonly localWorker?: (cloud: Cloud) => Promise<zkCloudWorker>;

  /**
   * Constructor for the API class
   * @param params the parameters for the API class
   * @param params.jwt The jwt token for authentication, get it at https://t.me/minanft_bot?start=auth
   * @param params.zkcloudworker The local worker for the serverless api to test the code locally
   * @param params.chain The blockchain network to use
   * @param params.webhook The webhook for the serverless api to get the results
   */
  constructor(params: {
    jwt: string;
    zkcloudworker?: (cloud: Cloud) => Promise<zkCloudWorker>;
    chain?: CanonicalBlockchain;
    webhook?: string;
  }) {
    const { jwt, zkcloudworker, webhook } = params;
    this.jwt = jwt;

    const chain = params.chain ?? "mina:devnet";
    this.chain = chain;
    this.endpoint =
      chain === "mina:devnet"
        ? ZKCLOUDWORKER_API + "devnet"
        : chain === "zeko:testnet"
        ? ZKCLOUDWORKER_API + "zeko"
        : chain === "mina:mainnet"
        ? ZKCLOUDWORKER_API + "mainnet"
        : undefined;
    this.webhook = webhook;
    if (jwt === "local") {
      if (zkcloudworker === undefined)
        throw new Error("worker is required for local mode");
      this.localWorker = zkcloudworker;
    }
  }

  /**
   * Starts a new job for the proof calculation using serverless api call
   * @param data the data for the proof call
   * @param data.developer the developer
   * @param data.repo the repo to use
   * @param data.transactions the transactions
   * @param data.task the task of the job
   * @param data.userId the userId of the job
   * @param data.args the arguments of the job, should be serialized JSON or string
   * @param data.metadata the metadata of the job, should be serialized JSON or string
   * @param data.webhook the webhook for the job
   * @returns { success: boolean, error?: string, jobId?: string }
   * where jonId is the jobId of the job
   *
   * The developers repo should provide a zkcloudworker function
   * that can be called with the given parameters, see the examples
   */
  public async recursiveProof(data: {
    developer: string;
    repo: string;
    transactions: string[];
    task?: string;
    userId?: string;
    args?: string;
    metadata?: string;
    webhook?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    const result = await this.apiHub("recursiveProof", data);
    if (
      result.data === "error" ||
      (typeof result.data === "string" && result.data.startsWith("error"))
    )
      return {
        success: false,
        error: result.error,
      };
    else if (result.success === false || result.data?.success === false)
      return {
        success: false,
        error:
          result.error ?? result.data?.error ?? "recursiveProof call failed",
      };
    else if (
      result.success === true &&
      result.data?.success === true &&
      result.data?.jobId !== undefined
    )
      return {
        success: result.success,
        jobId: result.data.jobId,
        error: result.error,
      };
    else
      return {
        success: false,
        error: "recursiveProof call error",
      };
  }

  /**
   * Starts a new job for the function call using serverless api call
   * @param data the data for the proof call
   * @param data.developer the developer
   * @param data.repo the repo to use
   * @param data.transactions the transactions
   * @param data.task the task of the job
   * @param data.userId the userId of the job
   * @param data.args the arguments of the job
   * @param data.metadata the metadata of the job
   * @param data.mode the mode of the job execution: "sync" will not create a job, it will execute the function synchronously within 30 seconds and with the memory limit of 256 MB
   * @returns { success: boolean, error?: string, jobId?: string, result?: any }
   * where jonId is the jobId of the job (for async calls), result is the result of the job (for sync calls)
   */
  public async execute(data: {
    developer: string;
    repo: string;
    transactions: string[];
    task: string;
    userId?: string;
    args?: string;
    metadata?: string;
    mode?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
    result?: any;
  }> {
    const result = await this.apiHub("execute", data);
    if (
      result.data === "error" ||
      (typeof result.data === "string" && result.data.startsWith("error"))
    )
      return {
        success: false,
        error: result.error,
      };
    else if (result.success === false || result.data?.success === false)
      return {
        success: false,
        error: result.error ?? result.data?.error ?? "execute call failed",
      };
    else if (
      result.success === true &&
      data.mode === "sync" &&
      result.data !== undefined
    )
      return {
        success: result.success,
        jobId: undefined,
        result: result.data,
        error: result.error,
      };
    else if (
      result.success === true &&
      data.mode !== "sync" &&
      result.data?.success === true &&
      result.data?.jobId !== undefined
    )
      return {
        success: result.success,
        jobId: result.data.jobId,
        result: undefined,
        error: result.error,
      };
    else
      return {
        success: false,
        error: "execute call error",
      };
  }

  /**
   * Sends transactions to the blockchain using serverless api call
   * @param data the data for the proof call
   * @param data.developer the developer
   * @param data.repo the repo to use
   * @param data.transactions the transactions
   * @returns { success: boolean, error?: string, txId?: string[] }
   * where txId is the transaction id of the transaction, in the sequence of the input transactions
   */
  public async sendTransactions(data: {
    developer: string;
    repo: string;
    transactions: string[];
  }): Promise<{
    success: boolean;
    error?: string;
    txId?: string[];
  }> {
    const result = await this.apiHub("sendTransactions", data);
    if (result.data === "error")
      // TODO: check if this is correct in AWS code
      return {
        success: false,
        error: result.error,
      };
    else
      return {
        success: result.success,
        txId: result.data,
        error: result.error,
      };
  }

  /**
   * Gets the result of the job using serverless api call
   * @param data the data for the jobResult call
   * @param data.jobId the jobId of the job
   * @param data.includeLogs include logs in the result, default is false
   * @returns { success: boolean, error?: string, result?: any }
   * where result is the result of the job
   * if the job is not finished yet, the result will be undefined
   * if the job failed, the result will be undefined and error will be set
   * if the job is finished, the result will be set and error will be undefined
   * if the job is not found, the result will be undefined and error will be set
   */
  public async jobResult(data: {
    jobId: string;
    includeLogs?: boolean;
  }): Promise<
    | {
        success: false;
        error?: string;
        result?: string;
      }
    | {
        success: true;
        error?: string;
        result: JobData;
      }
  > {
    const result = await this.apiHub("jobResult", data);
    if (this.isError(result.data))
      return {
        success: false,
        error: result.error,
        result: result.data,
      };
    else
      return {
        success: result.success,
        error: result.error,
        result: result.success ? (result.data as JobData) : result.data,
      };
  }

  /**
   * Deploys the code to the cloud using serverless api call
   * @param data the data for the deploy call
   * @param data.repo the repo to use
   * @param data.developer the developer
   * @param data.packageManager the package manager to use
   * @returns { success: boolean, error?: string, jobId?: string}
   * where jobId is the jobId of the job
   */
  public async deploy(data: {
    repo: string;
    developer: string;
    packageManager: string;
  }): Promise<{
    success: boolean;
    error?: string;
    jobId?: string;
  }> {
    // TODO: encrypt env.json
    const { repo, developer, packageManager } = data;
    const result = await this.apiHub("deploy", {
      developer,
      repo,
      args: packageManager,
    });
    if (
      result.data === "error" ||
      (typeof result.data === "string" && result.data.startsWith("error"))
    )
      return {
        success: false,
        error: result.error,
      };
    else
      return {
        success: result.success && result.data?.success,
        jobId: result.data?.jobId,
        error: result.error,
      };
  }

  /**
   * Gets the billing report for the jobs sent using JWT
   * @returns { success: boolean, error?: string, result?: any }
   * where result is the billing report
   */
  public async queryBilling(): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const result = await this.apiHub("queryBilling", {});
    if (this.isError(result.data))
      return {
        success: false,
        error: result.error,
        result: result.data,
      };
    else
      return {
        success: result.success,
        error: result.error,
        result: result.data,
      };
  }

  /**
   * Gets the remaining balance
   * @returns { success: boolean, error?: string, result?: any }
   * where result is the balance
   */
  public async getBalance(): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    const result = await this.apiHub("getBalance", {});
    if (this.isError(result.data))
      return {
        success: false,
        error: result.error,
        result: result.data,
      };
    else
      return {
        success: result.success,
        error: result.error,
        result: result.data,
      };
  }

  /**
   * Waits for the job to finish
   * @param data the data for the waitForJobResult call
   * @param data.jobId the jobId of the job
   * @param data.maxAttempts the maximum number of attempts, default is 360 (2 hours)
   * @param data.interval the interval between attempts, default is 20000 (20 seconds)
   * @param data.maxErrors the maximum number of network errors, default is 10
   * @param data.printLogs print logs, default is true
   * @returns { success: boolean, error?: string, result?: any }
   * where result is the result of the job
   */
  public async waitForJobResult(data: {
    jobId: string;
    maxAttempts?: number;
    interval?: number;
    maxErrors?: number;
    printLogs?: boolean; // print logs, default is true
  }): Promise<{
    success: boolean;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
  }> {
    if (this.jwt === "local") return this.jobResult({ jobId: data.jobId });
    const maxAttempts = data?.maxAttempts ?? 360; // 1 hour
    const interval = data?.interval ?? 10000;
    const maxErrors = data?.maxErrors ?? 10;
    const errorDelay = 30000; // 30 seconds
    const printedLogs: string[] = [];
    const printLogs: boolean = data.printLogs ?? true;

    function print(logs: string[]) {
      logs.forEach((log) => {
        if (printedLogs.includes(log) === false) {
          printedLogs.push(log);
          if (printLogs) {
            // replace all occurrences of "error" with red color
            const text = log.replace(/error/gi, (matched) =>
              chalk.red(matched)
            );
            console.log(text);
          }
        }
      });
    }
    let attempts = 0;
    let errors = 0;
    while (attempts < maxAttempts) {
      const result = await this.apiHub("jobResult", {
        jobId: data.jobId,
        includeLogs: printLogs,
      });
      const isAllLogsFetched =
        result?.data?.isFullLog === true || printLogs === false;
      if (
        printLogs === true &&
        result?.data?.logs !== undefined &&
        result?.data?.logs !== null &&
        Array.isArray(result.data.logs) === true
      )
        print(result.data.logs);
      if (result.success === false) {
        errors++;
        if (errors > maxErrors) {
          return {
            success: false,
            error: "Too many network errors",
            result: undefined,
          };
        }
        await sleep(errorDelay * errors);
      } else {
        if (this.isError(result.data) && isAllLogsFetched)
          return {
            success: false,
            error: result.error,
            result: result.data,
          };
        else if (result.data?.result !== undefined && isAllLogsFetched) {
          return {
            success: result.success,
            error: result.error,
            result: result.data,
          };
        } else if (result.data?.jobStatus === "failed" && isAllLogsFetched) {
          return {
            success: false,
            error: "Job failed",
            result: result.data,
          };
        }
        await sleep(interval);
      }
      attempts++;
    }
    return {
      success: false,
      error: "Timeout",
      result: undefined,
    };
  }

  /**
   * Calls the serverless API
   * @param command the command of the API
   * @param data the data of the API
   * */
  private async apiHub(
    command: ApiCommand,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: boolean; data?: any; error?: any }> {
    if (this.jwt === "local") {
      if (this.localWorker === undefined)
        throw new Error("localWorker is undefined");

      switch (command) {
        case "recursiveProof": {
          const jobId = await LocalCloud.run({
            command: "recursiveProof",
            data,
            chain: this.chain,
            localWorker: this.localWorker,
          });
          return {
            success: true,
            data: { success: true, jobId },
          };
        }
        case "execute": {
          const jobId = await LocalCloud.run({
            command: "execute",
            data,
            chain: this.chain,
            localWorker: this.localWorker,
          });
          if (data.mode === "sync")
            return {
              success: true,
              data: LocalStorage.jobEvents[jobId].result,
            };
          else
            return {
              success: true,
              data: { success: true, jobId },
            };
        }
        case "jobResult": {
          const job = LocalStorage.jobs[data.jobId];
          if (job === undefined) {
            return {
              success: false,
              error: "local job not found",
            };
          } else {
            return {
              success: true,
              data: job,
            };
          }
        }
        case "sendTransactions": {
          return {
            success: true,
            data: await LocalCloud.addTransactions(data.transactions),
          };
        }
        case "deploy":
          return {
            success: true,
            data: "local_deploy",
          };
        case "queryBilling":
          return {
            success: true,
            data: "local_queryBilling",
          };
        default:
          return {
            success: false,
            error: "local_error",
          };
      }
    } else {
      if (this.endpoint === undefined)
        throw new Error(
          "zkCloudWorker supports only mainnet, devnet and zeko chains in the cloud."
        );
      const apiData = {
        auth: ZKCLOUDWORKER_AUTH,
        command: command,
        jwtToken: this.jwt,
        data: data,
        chain: this.chain,
        webhook: this.webhook, // TODO: implement webhook code on AWS
      };

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiData),
        });
        if (!response.ok) {
          return {
            success: false,
            error: `fetch error: ${response.statusText} status: ${response.status}`,
          };
        }
        const data = await response.json();
        return { success: true, data: data };
      } catch (error: any) {
        console.error("apiHub error:", error.message ?? error);
        return { success: false, error: error };
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isError(data: any): boolean {
    if (data === "error") return true;
    if (data?.jobStatus === "failed") return true;
    if (typeof data === "string" && data.toLowerCase().startsWith("error"))
      return true;
    if (data !== undefined && data.error !== undefined) return true;
    return false;
  }
}
