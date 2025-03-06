import fs from "fs/promises";
import path from "path";

(async () => {
  // Get version from command line arguments
  const version = process.argv[2];
  if (!version) {
    console.error("Please provide a version number as an argument");
    process.exit(1);
  }

  // Validate version format (x.y.z)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error("Version must be in format x.y.z");
    process.exit(1);
  }

  const packages: string[] = [
    "",
    "api",
    "storage",
    "token",
    "upgradable",
    "nft",
    "abi",
    "mina-utils",
    "mina-prover",
    "mina-curves",
    "prover",
  ];

  for (const pkg of packages) {
    // Determine package directory
    const packageDir = pkg === "" ? "." : `packages/${pkg}`;

    // Load package.json
    const packageJsonPath = path.join(packageDir, "package.json");
    let packageJson;
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    } catch (error) {
      console.error(`Failed to read ${packageJsonPath}:`, error);
      continue;
    }

    // Update version
    packageJson.version = version;

    // Update dependencies
    ["devDependencies", "peerDependencies"].forEach((depType) => {
      const deps = packageJson[depType];
      if (deps) {
        Object.keys(deps).forEach((depName) => {
          if (/^@silvana-one\//.test(depName)) {
            deps[depName] = version;
          }
        });
      }
    });

    // Write updated package.json back to file
    try {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n"
      );
      console.log(`Updated ${packageJsonPath}`);
    } catch (error) {
      console.error(`Failed to write ${packageJsonPath}:`, error);
    }
  }
})();
