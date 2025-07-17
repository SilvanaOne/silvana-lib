import { PinataSDK } from "pinata";

// IPFS
const pinataJwt = process.env.PINATA_JWT;
const pinataGateway = process.env.PINATA_GATEWAY_URL;
const pinataGatewayKey = process.env.PINATA_GATEWAY_API_KEY;

const pinata = new PinataSDK({
  pinataJwt,
  pinataGateway,
  pinataGatewayKey,
});

export async function saveToIPFS(params: {
  data: string;
  filename?: string;
  owner?: string;
  days?: number;
  description?: string;
}): Promise<string | undefined> {
  try {
    if (!pinataJwt || !pinataGateway || !pinataGatewayKey) {
      throw new Error(
        "PINATA_JWT, PINATA_GATEWAY_URL, or PINATA_GATEWAY_API_KEY is not set"
      );
    }
    const { data, filename, owner, days, description } = params;
    if (data === undefined || data === null) throw new Error("data is not set");
    if (typeof data !== "string") throw new Error("data is not a string");
    if (data.length === 0) throw new Error("data is empty");

    const file = new File([data], filename ?? "da", {
      type: "text/plain",
    });
    const expiry = days ? Date.now() + days * 24 * 60 * 60 * 1000 : undefined;
    const keyvalues = {
      app: "dex:devnet",
      owner: owner ?? "",
      expires: expiry ? new Date(expiry).toISOString() : "never",
      expiry: expiry ? expiry.toString() : "0",
      description: description ?? "",
      type: "text/plain",
      mime_type: "text/plain",
    };

    const upload = await pinata.upload.public
      .file(file, {
        metadata: {
          name: filename ?? "da",
          keyvalues,
        },
      })
      .name(filename ?? "da");

    console.log("IPFS: ", upload.cid);
    return upload.cid;
  } catch (error: any) {
    console.error("Save to IPFS failed", error.message);
    return undefined;
  }
}

export async function readFromIPFS(params: {
  blobId: string;
}): Promise<string | undefined> {
  const { blobId } = params;
  if (!blobId) {
    throw new Error("blobId is not set");
  }
  try {
    if (!pinataJwt || !pinataGateway || !pinataGatewayKey) {
      throw new Error(
        "PINATA_JWT, PINATA_GATEWAY_URL, or PINATA_GATEWAY_API_KEY is not set"
      );
    }
    const url = await getIPFSUrl({ blobId });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch from IPFS");
    }
    const data = await response.text();
    return data;
  } catch (error: any) {
    console.error("Read from IPFS failed", error);
    return undefined;
  }
}

export async function getIPFSUrl(params: { blobId: string }): Promise<string> {
  const { blobId } = params;
  if (!blobId) {
    throw new Error("blobId is not set");
  }
  const gateway =
    process.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs/";
  const apiToken = process.env.PINATA_GATEWAY_API_KEY;

  const url =
    "https://" +
    gateway +
    "/ipfs/" +
    blobId +
    (apiToken ? "?pinataGatewayToken=" + apiToken : "");
  return url;
}
