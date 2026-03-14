import { computeContentHash, decodeCompressedContent } from "./contentDecoder";
import { gzipSync } from "fflate";

function makeCompressed(json: string, hashValue: string): string {
  const bytes = new TextEncoder().encode(json);
  const compressed = gzipSync(bytes);
  let binary = "";
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return `${hashValue}:${btoa(binary)}`;
}

describe("computeContentHash", () => {
  it("returns a deterministic hash", () => {
    const h1 = computeContentHash("hello world");
    const h2 = computeContentHash("hello world");
    expect(h1).toBe(h2);
  });

  it("returns different hashes for different input", () => {
    const h1 = computeContentHash("abc");
    const h2 = computeContentHash("def");
    expect(h1).not.toBe(h2);
  });

  it("returns a non-empty string", () => {
    expect(computeContentHash("test").length).toBeGreaterThan(0);
  });
});

describe("decodeCompressedContent", () => {
  it("round-trips compress/decompress", () => {
    const original = JSON.stringify([{ id: 1, value: 42 }]);
    const payload = makeCompressed(original, "abc123");

    const result = decodeCompressedContent(payload);
    expect(result.hash).toBe("abc123");
    expect(result.json).toBe(original);
  });

  it("handles colons in the base64 portion", () => {
    // hash itself should not contain ':', but base64 won't either;
    // still verify splitting only on the first colon works
    const json = '{"key":"value"}';
    const payload = makeCompressed(json, "myhash");
    const result = decodeCompressedContent(payload);
    expect(result.json).toBe(json);
  });

  it("throws on missing colon separator", () => {
    expect(() => decodeCompressedContent("nocolonhere")).toThrow("missing ':'");
  });

  it("throws on invalid base64", () => {
    expect(() => decodeCompressedContent("hash:!!!invalid!!!")).toThrow();
  });

  it("throws on corrupt gzip data", () => {
    const fakeBase64 = btoa("this is not gzip data");
    expect(() => decodeCompressedContent(`hash:${fakeBase64}`)).toThrow();
  });
});
