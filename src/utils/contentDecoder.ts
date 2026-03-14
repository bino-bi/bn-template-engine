import hash from "@emotion/hash";
import { gunzipSync } from "fflate";

/**
 * Compute a short deterministic hash of a string.
 */
export function computeContentHash(text: string): string {
  return hash(text);
}

/**
 * Decode a compressed payload in the format `<hash>:<base64_gzip>`.
 * Returns the embedded hash and the decompressed JSON string.
 */
export function decodeCompressedContent(text: string): { hash: string; json: string } {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid compressed format: missing ':' separator");
  }

  const embeddedHash = text.slice(0, colonIndex);
  const base64Data = text.slice(colonIndex + 1);

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decompressed = gunzipSync(bytes);
  const json = new TextDecoder().decode(decompressed);

  return { hash: embeddedHash, json };
}
