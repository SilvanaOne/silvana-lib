// Get Silvana registry package address from environment variables
// Compatible with both Node.js and Next.js environments
export const silvanaRegistryPackage =
  process.env.SILVANA_REGISTRY_PACKAGE ??
  process.env.NEXT_PUBLIC_SILVANA_REGISTRY_PACKAGE ??
  "@silvana/agent";

// Get Silvana registry address from environment variables
// Compatible with both Node.js and Next.js environments
export const silvanaRegistryAddress =
  process.env.SILVANA_REGISTRY_ADDRESS ??
  process.env.NEXT_PUBLIC_SILVANA_REGISTRY_ADDRESS;