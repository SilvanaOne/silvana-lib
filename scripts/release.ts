import { execSync } from "child_process";
import readline from "readline";

(async () => {
  // Run the build command
  execSync("npm run build", { stdio: "inherit" });

  // Prompt the user for the OTP
  const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const otp: string = await new Promise((resolve) => {
    rl.question("Enter OTP: ", (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // List of your packages
  const packages: string[] = [
    "@silvana-one/api",
    "@silvana-one/storage",
    "@silvana-one/token",
    "@silvana-one/upgradable",
    "@silvana-one/nft",
    "@silvana-one/abi",
    "@silvana-one/mina-utils",
    "@silvana-one/mina-prover",
    "@silvana-one/mina-curves",
    "@silvana-one/prover",
  ];

  // Run the release command for each package
  packages.forEach((pkg: string) => {
    execSync(`npm run release -w ${pkg}`, {
      env: { ...process.env, NPM_CONFIG_OTP: otp },
      stdio: "inherit",
    });
  });
})();
