import { getProof, txStatus } from "./client/sdk.gen.js";

export async function waitForProofs(
  jobId: string
): Promise<(string | undefined)[] | undefined> {
  console.log("Job ID:", jobId);
  let errorCount = 0;
  const startTime = Date.now();
  console.log("Waiting for job result...");
  while (errorCount < 100 && Date.now() - startTime < 1000 * 60 * 10) {
    try {
      const jobResults = (await getProof({ body: { jobId } })).data;
      const jobStatus = jobResults?.jobStatus;

      if (
        jobResults?.success === true &&
        (jobStatus === "finished" || jobStatus === "used")
      ) {
        return jobResults.results?.map((result) => result.hash ?? "") ?? [];
      }

      if (jobStatus === "failed") {
        console.error(`Job ${jobId} failed`);
        return undefined;
      }
    } catch (error) {
      errorCount++;
      console.error(error);
    }
    await sleep(10000);
  }
  return undefined;
}

export async function waitForTransaction(
  hash: string,
  timeout = 1000 * 60 * 60 * 5
) {
  console.log(`Waiting for transaction ${hash} to be included in a block...`);
  const startTime = Date.now();
  let status = "pending";
  let errorCount = 0;
  while (
    status !== "applied" &&
    errorCount < 100 &&
    Date.now() - startTime < timeout
  ) {
    try {
      const result = (await txStatus({ body: { hash } })).data;
      status = result?.status ?? "pending";
      if (status === "failed") {
        throw new Error(
          `Transaction ${hash} failed: ${JSON.stringify({ result })}`
        );
      } else if (status === "applied") {
        console.log(`Transaction ${hash} included in a block`, result);
        return;
      }
    } catch (error) {
      errorCount++;
      console.error(error);
    }

    await sleep(30000);
  }
  throw new Error(
    `Transaction ${hash} not included in a block, timeout or too many errors`
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
