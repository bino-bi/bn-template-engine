/** Utility for decoding `data:` URIs containing base64-encoded JSON. */
export class DataUriUtil {
  /** Decodes a base64 data URI and parses the payload as JSON. */
  public static dataURItoObject(dataURI: string): unknown {
    // Split the Data URI into its parts
    const parts = dataURI.split(",");
    // Check if Data URI is in correct format
    if (parts.length !== 2 || parts[0].indexOf("data:") !== 0) {
      throw new Error("Invalid Data URI format");
    }

    // Extract the data portion
    const data = parts[1];

    // Decode the base64 encoded data
    const decodedData = atob(data);

    // Parse the JSON string into an object
    const jsonObject = JSON.parse(decodedData);

    return jsonObject;
  }
}
