export async function buildMovePackage(path: string): Promise<{
  modules: string[];
  dependencies: string[];
  digest: number[];
}> {
  const { execSync } = await import("child_process");
  let bytes:
    | {
        modules: string[];
        dependencies: string[];
        digest: number[];
      }
    | undefined = undefined;

  console.log("Running sui client publish command...");
  try {
    const output = execSync(
      `sui move build --dump-bytecode-as-base64 --ignore-chain --path ${path}`,
      {
        encoding: "utf-8",
      }
    );
    bytes = JSON.parse(output);
    if (!bytes) {
      throw new Error("Error building package");
    }
    return bytes;
    //console.log("Command output:", bytes);
  } catch (error) {
    console.error("Error running command:", error);
    throw error;
  }
}
