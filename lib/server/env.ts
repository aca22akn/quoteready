import "server-only";

// The only module allowed to read process.env. Values are never logged or returned to users.

export class ConfigError extends Error {
  constructor(public readonly missing: string) {
    super(`Missing configuration: ${missing}`);
  }
}

function required(name: "QUOTEREADY_ANTHROPIC_KEY" | "SUPABASE_URL" | "SUPABASE_SECRET_KEY"): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new ConfigError(name);
  return value;
}

export function anthropicKey(): string {
  return required("QUOTEREADY_ANTHROPIC_KEY");
}

export function supabaseConfig(): { url: string; secretKey: string } {
  return { url: required("SUPABASE_URL"), secretKey: required("SUPABASE_SECRET_KEY") };
}

export type EvalProfile = "haiku-low" | "haiku-default" | "sonnet";

export function evalProfile(): EvalProfile {
  const value = process.env.QUOTEREADY_EVAL_PROFILE;
  if (value === "haiku-default" || value === "sonnet") return value;
  return "haiku-low";
}
