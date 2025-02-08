export async function pinJSON(params: {
  data: string | object;
  name?: string;
  keyvalues?: object;
  auth?: string;
}): Promise<string | undefined> {
  const {
    data,
    name = "data.json",
    keyvalues = { library: "zkcloudworker" },
  } = params;
  const auth =
    params.auth ??
    process.env.PINATA_JWT ??
    process.env.NEXT_PUBLIC_PINATA_JWT ??
    process.env.REACT_APP_PINATA_JWT;
  if (!auth)
    throw new Error(
      "pinJSON: auth, PINATA_JWT, NEXT_PUBLIC_PINATA_JWT or REACT_APP_PINATA_JWT should be defined"
    );

  try {
    const pinataData = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name,
        keyvalues,
      },
      pinataContent: data,
    };

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + auth,
      },
      body: JSON.stringify(pinataData),
    });

    if (!res.ok) {
      throw new Error(`Pinata error: status: ${res.status} ${res.statusText}`);
    }

    const responseData = await res.json();
    console.log("saveToIPFS result:", responseData);
    return (
      responseData as unknown as { IpfsHash: string | undefined } | undefined
    )?.IpfsHash;
  } catch (error: any) {
    console.error("saveToIPFS error:", error?.message);
    return undefined;
  }
}
