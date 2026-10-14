import { extract } from "@/lib/extraction/extract";
import { handleAnalyze } from "@/lib/server/analyze";
import { anthropicClient } from "@/lib/server/anthropic";
import { finishError, insertAttempt, lookupExact, saveResult } from "@/lib/server/repo";

// Worst case: Haiku 20 s timeout + one Sonnet retry 20 s + database calls, about 42 s.
// Vercel Hobby allows up to 300 s with fluid compute (60 s without), per the current docs.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAnalyze(request, {
    insertAttempt,
    finishError,
    saveResult,
    lookup: lookupExact,
    extract: (email) => extract(email, anthropicClient()),
  });
}
