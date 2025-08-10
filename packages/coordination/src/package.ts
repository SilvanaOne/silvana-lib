// Get Silvana registry package address from environment variables
// Compatible with both Node.js and Next.js environments
export const silvanaRegistryPackage =
  process.env.SILVANA_REGISTRY_PACKAGE ??
  process.env.NEXT_PUBLIC_SILVANA_REGISTRY_PACKAGE ??
  "@silvana/agent";