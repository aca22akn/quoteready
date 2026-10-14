# QuoteReady: decisions, run sheet, protocols, README skeleton, email

Planning text only. This supersedes the run sheet, cut ladder and open items in handoff 3.

## 1. Decisions on handoff 3 section 5 (settled by the advisor, Ak can override)

| # | Recommendation | Verdict | Why |
|---|---|---|---|
| 1 | Do not run the clock late in the evening | Overridden by timing | Ak starts about 17:00 and finishes about 19:00. |
| 2 | Schema budget of 10 nullable-evidence fields | Adapted | 11 fields (item type added so nuts can be refused), hard cap 12, limit 16. Measure first-call latency, fall back to a flatter shape if slow. |
| 3 | Extraction config, map words to values in code | Accepted | Haiku 5.5 low effort, one Sonnet 5.5 retry with between_tools thinking, one config constant. |
| 4 | Secrets protocol and log scan | Accepted | Plus a read-only code-review gate before each keyed run (section 5). |
| 5 | Mandatory daily cron, and recorded-extraction fallback for demos | Adapted and rejected | Cron is best effort and not a gate (Hobby runs it once a day with up to an hour of drift). The recorded fallback is rejected: it would hide the AI path from reviewers, spend is tiny, and the README states the limit instead. |
| 6 | Drop the public history page, add a no-personal-data notice | Accepted | A history page would show strangers' pasted text. |
| 7 | Live slice by minute 60, first eval about 68 | Accepted | Freeze stays at 75. |
| 8 | Extra edge cases | Accepted | R9 now covers packs and approximations, R12 added as a should-have, standard inference added, T26 to T34 added. |
| 9 | Mirror algosoup's language | Accepted | Rule id, evidence and as-of date on every line, substitutions first-class, the README sections in section 7. |
| 10 | Make steering visible in the log | Accepted | Plan mode with real corrections, tests first, one change at a time, a review pass, the eval find-and-fix loop. |
| 11 | Choose the model deliberately | Accepted | Opus 5.5 for the plan, the rules and the gate. If the usage bar is above about half at minute 45, switch to Sonnet 5.5 for UI and README. The threshold is a suggestion, not a measurement. |

Other decisions: the outcome is decided by severity with all pre-lookup rules run. Substitution stays READY but is shown as its own block and confirmed at approval. Approve and reject stay, labelled as a reviewer decision with no identity. The rehearsal local folder is kept until after submission. Added after a second review: severity is applied per line; gated lines get no lookup (T3 shows no SKU or price, and showing the refused row is a flex item); R12 is narrowed and R13 added as a material-swap defence; the first eval run is the primary config only and no failure is staged; retries skip configuration and billing errors.

## 2. Go checklist (about 10 minutes, then start)

1. Files placed: CLAUDE.md in the root of C:\dev\quoteready, and the three planning files in a planning folder there.
2. Copy the .claude folder from the rehearsal project into C:\dev\quoteready so the env-file deny rules and the secrets-folder deny rule apply from the first prompt. Confirm settings.local.json is not committed later.
3. Update the secrets launcher script to point at C:\dev\quoteready.
4. In the Claude tab, open Claude Code in C:\dev\quoteready, check you are logged in, run /model and select Opus 5.5, and look at the usage bar. Run /export once on a trivial prompt to confirm it works.
5. Check git config user name and email (the commit identity is the aca22akn noreply address).
6. Repo visibility decision. Recommended: public, with no secrets and a synthetic catalogue, so reviewers need no invite.
7. Three tabs: secrets tab (launcher only), Claude tab, normal tab (git push, Vercel dashboard).
8. Write the start time on paper. Water, food, phone away.

## 3. Run sheet (minutes from clock start; estimates, not measurements)

| Minutes | Work | Gate |
|---|---|---|
| 0 to 10 | Brief, plan mode, you correct the plan, scaffold, git init, first push | Plan accepted with at least one real correction |
| 10 to 25 | schema and seed scripts (agent writes, you review and run in the Supabase editor), env vars, vercel.json, health route, import to Vercel, deploy | G1 at 25: live short URL with the health route. If late, deploy a bare shell first |
| 25 to 45 | Failing Vitest cases from file 01, then the pure rules including R13, the designation parser and the per-line severity merge | G2 at 45: tests green, type check clean |
| 45 to 60 | Security gate (section 5), extraction schema and route, verification, retry, persistence, plain UI, five demo buttons. You run the dev server in the secrets tab | G3 at 60: end to end locally, T1 and T2 pass. Run /export as insurance |
| 60 to 68 | Eval runner and first run: primary config only (Haiku 5.5 low effort) over all 20 cases. You paste the summary into Claude Code | G4 at 68: first real numbers recorded and every miss diagnosed. Do not stage a failure. If all pass, say so and inspect the HARD cases by hand |
| 68 to 75 | Fix any real misses from the first eval, add R8, R9, R11, R12 and approve/reject if not built, push, production variables, first live demo | Freeze at 75. Anything not green leaves the UI and the README |
| 75 to 100 | Live smoke of the L-layer cases (T1, T2, T3, T11, T16, T35) and the five demos. The mocked route tests (I layer) run in the normal test command, not live. Second eval run, including the two other configs if time allows. Code review pass and a fresh-eyes sub-agent review, triage in the log, fix only | G5 at 100: live passes the five demos |
| 100 to 115 | README, incognito check of the short URL, final checks (section 6), final push, wait for Ready, /export, send | Sent by 115 |
| 115 to 120 | Buffer | None |

A gate missed by more than 5 minutes triggers the next cut at once.

## 4. Cut ladder (cut first at the top)

1. Visual polish: plain shadcn components.
2. Sonnet retry if the eval shows no need, grounding enforcement beyond the evidence check.
3. Hourly cap, R11, approve and reject persistence (replace with a static "Draft: human review required" label, never a button that can approve a mixed RFQ).
4. R8 and R9 minimal versions, the R12 unexplained-number coverage heuristic (the revised-quantity check is never cut), duplicate-line flag (keep the input cap). R13 may be cut only if the material-swap case is then documented as a known limit and the README makes no injection-immunity claim.
5. Multi-line UI (the API keeps the items list, the UI shows a plain list), and the eval set shrinks to 12.

Never cut: the live deploy, rules R1 to R7 core, the tests, the log export, an eval run with real numbers, README honesty.

Flex menu when ahead, in order: live smoke script, metadata panel (model, latency, tokens), deterministic clarification email draft, compliant alternatives on NO MATCH (flagged customer must confirm; this is where a read-only look at the refused row belongs), evidence highlight in the pasted text, rules page, keep-alive extras, evals page. Not a history page.

## 5. Protocols

Secrets. Keys live in a file outside the project, loaded by the launcher in the secrets tab. Check once that the tab itself does not hold the variables after the server stops (print one variable name in that tab and confirm it is empty). Never run Claude Code in that tab.

Moving the file outside the repo is not an operating-system boundary under the same Windows user. The remaining risk is that the agent edits code that later runs with the key. So before the first keyed launch and before every production deploy, in the normal tab, read the output of: a search for process.env (only the env module and config files should appear), a search for console output calls (read each hit for env or header output), a diff of package.json and the lockfile since the last check (dependencies you did not approve), and a search for fetch calls and URLs (only Anthropic and Supabase hosts).

Live keys. The agent runs unit and route tests with a mocked model. You run anything that needs keys. After an eval run, paste the summary into Claude Code so the log has it.

The advisor chat. During the window the advisor reviews what Claude Code does against the rules and facts in these files and flags real problems briefly. It never writes code, SQL or prompts for you. Tell Claude Code what you took from it and say so in the session, so the log is honest.

Log hygiene. Before sending, scan the exported file read-only for credential-shaped values: the Anthropic key prefix followed by at least 20 key characters (letters, digits, hyphen, underscore), and the Supabase secret key prefix followed by at least 20 key characters. A bare mention of a prefix is not a leak (the planning documents and the rules say the words), so it must not trigger rotation. Report only the file name and match count, never print the matched text. If a value-shaped match is a real key, rotate that key and disclose it. Never edit the log. Do not rotate the Supabase key after submission unless it leaked, because the live app depends on it.

Mistakes to expect in the first plan or code, so you can catch them: rule order instead of severity, application mapping in the model only, a sku or price field in the schema, route exports that Cache Components forbids, a .env.local file, adding all files to git at once, fuzzy product search, a stack trace in an error response, READY as the default when a check throws, an unbounded retry loop, trusting a quantity the evidence says is boxes, dropping a nut line instead of refusing it, reading process.env outside the env module.

## 6. Final checks (minutes 100 to 115, normal tab, one at a time)

1. Lint, then the type check with no emit, then the tests, then the build.
2. Dependency audit for production dependencies, read only. Never auto-fix with force.
3. Repo scan: search the full git history for credential-shaped values (the same two patterns as the log scan: each key prefix followed by at least 20 key characters), reporting only counts and file names. It should find nothing. A bare prefix mentioned in a planning file is not a match.
4. Push to main only. Wait for the production deployment to say Ready, not Blocked.
5. Open the short vercel.app URL in an incognito window and click all five demos.
6. Run /export, check the file opens, run the log scan.
7. Submit the short production domain, not a long generated URL.

## 7. README skeleton

1. What it is, in three lines, plus the demo steps (and a screenshot if time allows).
2. Where AI is used and where it is not. The model reads. Code decides. No SKU, price or stock from the model, and how that is enforced.
3. Outcomes and rules table with the basis and confidence of each rule. Note that R4 is house policy.
4. How a decision is shown: rule id, evidence snippet, and price and stock as of. Substitutions shown as their own block.
5. Data model and why three tables.
6. Checks: unit and route test counts, eval results per config as N of M, the false-READY count, the real misses and what fixed them, the injection tests, and the isolation checks (browser cannot reach Supabase, no secret in the client bundle).
7. Cost per RFQ computed from the recorded usage tokens, with the model and config used. No savings claims.
8. What was done before the clock and how. Planning notes, the rules and domain sheet, the test table, seed spec, eval set, brief and this skeleton were prepared with Claude in a separate chat. A throwaway rehearsal in a scratch project tested the AI call, the database connection, region, cron, deploy pipeline and a secrets-handling test. None of its routes were copied. Exactly what remains: the rehearsal's Vercel project was deleted on 14 October, its GitHub repo and local folder are kept until after submission, and the real app reuses the same Supabase project and Anthropic key (the rehearsal table is separate from the real tables).
9. What was built in the session. All product code, SQL, seed data and prompts were written by Claude Code in the logged session. During the session the same separate Claude chat acted as an advisor: it reviewed what the agent was doing against the rules and flagged problems, and wrote no code, SQL or prompts.
10. Known limits (file 01, section 9) and whether the hourly cap is live.
11. What would earn auto-send: measured accuracy at a stated threshold, a stock feed with timestamps, and a named owner for the rules.
12. Week 1 with a real distributor, five discovery questions: how RFQs arrive today, how long a quote takes, which errors cost most, who owns the rules, which systems hold stock.
13. Demand is a hypothesis. Optional: a small self-test timing 5 sample RFQs by hand versus with the tool, labelled as a small self-test.
14. Run it locally, environment variable names without values, the Vercel Hobby non-commercial note, and how to resume a paused Supabase project.

## 8. Submission email draft

Placeholders are in brackets. The recipient and send method are not known yet.

Subject: QuoteReady take-home: a fasteners RFQ tool that refuses to guess

Hi [name],

My take-home is finished in [X] minutes of the 2 hours.

Live app: [short production URL]
Repo: [GitHub URL]
Claude Code log: [attached or link], from /export, not edited.

QuoteReady reads a messy fastener enquiry and either drafts a quote line from a real product row, asks for what is missing, or refuses and shows the rule that fired. The model only extracts a spec with evidence. It never outputs a SKU, a price or a stock figure, and the schema has no field for them. The README reports the eval results, including the cases it got wrong.

Before the clock I prepared planning notes and a throwaway rehearsal of the deploy and the AI call, and I used a separate Claude chat as an advisor during the run. All product code, SQL, seed data and prompts were written in the logged session. The README lists exactly what was done where.

One thing I would value your view on: how a DIN 933 request should be handled when the ISO 4017 part we supply has a different spanner size.

Abdullah

## 9. Do not

Auto-fix dependencies with force. Paste any key or .env content into chat. Set ANTHROPIC_API_KEY as a Windows variable. Launch Claude Code from the secrets tab. Add all files to git at once. Submit a long generated Vercel URL, push to any branch except main, or submit before the final production deployment says Ready. Edit or trim the exported log. Treat anything marked unverified as fact.
