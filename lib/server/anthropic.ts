import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_CONFIG } from "@/lib/extraction/config";
import { anthropicKey } from "./env";

// SDK retries off (the app owns the single Sonnet retry); timeout in milliseconds for the TS SDK.
export function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: anthropicKey(), maxRetries: 0, timeout: EXTRACTION_CONFIG.timeoutMs });
}
