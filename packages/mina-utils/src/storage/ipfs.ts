export function createIpfsURL(params: {
  hash: string;
  gateway?: string;
  apiToken?: string;
}): string {
  let { hash, gateway, apiToken } = params;
  gateway ??=
    process.env.PINATA_IPFS_GATEWAY ??
    process.env.NEXT_PUBLIC_PINATA_IPFS_GATEWAY ??
    process.env.REACT_APP_PINATA_IPFS_GATEWAY;
  apiToken ??=
    process.env.PINATA_GATEWAY_TOKEN ??
    process.env.NEXT_PUBLIC_PINATA_GATEWAY_TOKEN ??
    process.env.REACT_APP_PINATA_GATEWAY_TOKEN;

  if (!gateway) {
    gateway = "https://gateway.pinata.cloud/ipfs/";
  }
  return gateway + hash + (apiToken ? "?pinataGatewayToken=" + apiToken : "");
}
