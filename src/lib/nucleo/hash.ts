// Hash SHA-256 (integridade de citação — princípio P1) e do arquivo (dedupe de ingestão).
import { webcrypto } from "node:crypto";

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await webcrypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
