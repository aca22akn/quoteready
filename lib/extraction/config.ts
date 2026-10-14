// One place for the extraction settings, so the eval can sweep them. Parameter names checked against
// the claude-api skill docs: output_config.effort, thinking.type "between_tools" (Sonnet 5.5 only, effort high or below).

export type ExtractionCall = {
  model: string;
  effort?: "low" | "medium" | "high";
  thinking?: { type: "between_tools" };
  maxTokens: number;
};

export const EXTRACTION_CONFIG = {
  primary: { model: "claude-haiku-5-5", effort: "low", maxTokens: 3000 } satisfies ExtractionCall,
  retry: { model: "claude-sonnet-5-5", thinking: { type: "between_tools" }, maxTokens: 3000 } satisfies ExtractionCall,
  timeoutMs: 20_000,
} as const;

export const EVAL_PROFILES: Record<"haiku-low" | "haiku-default" | "sonnet", ExtractionCall> = {
  "haiku-low": EXTRACTION_CONFIG.primary,
  "haiku-default": { model: "claude-haiku-5-5", maxTokens: 3000 },
  sonnet: EXTRACTION_CONFIG.retry,
};
