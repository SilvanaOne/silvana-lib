import { suiClient } from "./sui-client.js";

export async function fetchSuiObject(objectID: string) {
  const data = await suiClient.getObject({
    id: objectID,
    options: {
      showContent: true,
    },
  });
  return data;
}

export async function fetchSuiDynamicField(params: {
  objectID?: string;
  parentID?: string;
  fieldName: string;
  type: string;
  key: string;
}): Promise<object | undefined> {
  try {
    const { objectID, parentID, fieldName, type, key } = params;

    if (!objectID && !parentID) {
      console.error("objectID or parentID is required");
      return undefined;
    }
    let id = parentID;
    if (objectID && !parentID) {
      const suiObject = (await fetchSuiObject(objectID)) as any;

      id = (suiObject?.data?.content?.fields?.[fieldName] as any)?.fields?.id
        ?.id;
    }
    if (!id) {
      return undefined;
    }

    const field = await suiClient.getDynamicFieldObject({
      parentId: id,
      name: {
        type,
        value: key,
      },
    });

    return (field.data?.content as any)?.fields as object;
  } catch (error: any) {
    console.error(
      "fetchSuiDynamicField: Error fetching dynamic field",
      error?.message
    );
    return undefined;
  }
}
