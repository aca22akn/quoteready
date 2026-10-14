# QuoteReady: working rules for Claude Code

Read this at the start of every session. Planning documents are in the planning folder and were written before the clock started. All product code, SQL, seed data and prompts are written in this session, by you, under review.

## What this is

QuoteReady is a demo RFQ tool for a UK fasteners and fixings distributor, built for the algosoup forward deployed engineer take-home. A sales engineer pastes a messy customer email. The model only reads it and extracts a structured spec with evidence. Plain code and a products table decide each line: READY TO QUOTE, CLARIFICATION REQUIRED or NO COMPLIANT MATCH. A human reviews the draft. The catalogue is synthetic and must be labelled as such wherever it is shown. Demand is a hypothesis, not validated.

## Hard boundaries (each one needs a test that proves it)

1. The model never produces a SKU, price, stock figure or lead time. No such field exists in the extraction schema. Product facts come only from product rows.
2. Doubt ends in CLARIFICATION or NO MATCH, never READY. Every error, parse failure or missing evidence pushes toward refusal.
3. Customer text is data, never instructions (see the injection policy below).
4. Rules are pure functions in the rules folder: no I/O, no model calls. Each returns a rule id, an outcome class and a reason a sales engineer can read.
5. Precedence is by severity, not by file order, and it is applied per line. For each line, all pre-lookup rules run so every reason is shown, and the strictest outcome wins: NO MATCH over CLARIFICATION over READY. The database lookup runs for a line only if none of that line's pre-lookup rules forced NO MATCH or CLARIFICATION, so independently valid lines in the same RFQ are still looked up and priced. A gated line never shows a SKU, price or stock. The RFQ badge is the worst line, and the RFQ-level checks (R10, R12, R13) can raise it to CLARIFICATION. R3 suppresses R4.
6. Money is integer pence. Format it only at the edge.
7. The browser never talks to Supabase. Database access is server side with the secret key, in modules that import server-only.
8. The public endpoint rejects empty input and input over 4,000 characters before any model call, and rejects more than 10 extracted lines.
9. An attempt row is inserted before the model call, so failed calls are counted and visible. A failed attempt has no quote lines.
10. Every decision shown to the user carries the rule id, the evidence snippet, and for READY lines the "price and stock as of" date.
11. Approval is allowed only when the RFQ badge is READY with no RFQ-level warnings, and the server enforces it. Each item carries its own source text, and its evidence snippets are checked against that source text, not only the whole email. A quantity revised in the email is caught by a code check, not left to the model.

## Secrets (non-negotiable)

- Never read, print, grep, cat, search or open any file whose name starts with .env, and never touch anything under C:\dev\secrets. Do not try to get around a blocked read with a shell command, a script or a search tool. If something is blocked, say so and ask Ak.
- Never echo environment variables. Never log env values or request headers. Never ask Ak to paste a key.
- Only the env module may read process.env. Errors shown to users never contain key text or stack traces.
- The variable names are QUOTEREADY_ANTHROPIC_KEY, SUPABASE_URL and SUPABASE_SECRET_KEY. Do not use ANTHROPIC_API_KEY. Nothing secret gets a NEXT_PUBLIC prefix.
- Secrets protocol: Ak keeps the keys in a file outside the project and loads them in a dedicated secrets tab, which runs only the dev server, the eval and live smoke checks. Claude Code is never launched from that tab. You do not have the keys in your environment, by design.
- Anything that needs live keys (the dev server, the eval, live smoke checks) is run by Ak in the secrets tab. Ask him to run it and paste the summary output back. You run unit and route tests with a mocked model.
- Before any dependency is added, tell Ak the package name and why. The only outbound network calls in the app are the Anthropic SDK and Supabase.

## Models and extraction configuration

- One configuration constant holds the model, effort, thinking mode and max output tokens, so the eval can sweep it.
- Primary extraction: Haiku 5.5 (model name claude-haiku-5-5) with effort set to low. In the rehearsal this produced zero thinking tokens and answered in about 2.5 seconds.
- One retry only, on Sonnet 5.5 (model name claude-sonnet-5-5) with thinking type set to between_tools. Do not disable thinking on Sonnet. The retry triggers only on recoverable failures: a refusal, a max_tokens stop, a schema or validation failure, a timeout or network error, a server error, or an overloaded or rate-limit response. It does not trigger on configuration or billing failures such as a missing or invalid key, a forbidden response, an invalid request or exhausted credit. Those go straight to a clear configuration error state with no key text, because a retry cannot fix them. If the retry also fails, show the provider-error state, mark the attempt ERROR and save no quote lines. Never loop. Set a per-call timeout of about 20 seconds and set the SDK's own automatic retry count to zero (verify the option name in the SDK docs), so the application owns the single Sonnet retry and the worst case is two calls, about 40 seconds, inside the 60 second function limit. Test that path with a mocked timeout.
- Both settings worked in the rehearsal, but take exact parameter names from the official Anthropic docs, not from memory.
- Thinking tokens count toward max_tokens, so set max_tokens generously (about 3,000).
- Record model, whether the fallback was used, latency and input and output tokens on every attempt, so cost per RFQ can be computed for the README.

## Structured output rules (from the docs)

- Use the structured output setting with a JSON schema. No beta header is needed.
- additionalProperties is false at every level. No numeric or string constraints in the schema (the validation library enforces ranges afterwards). No recursion. No reasoning or explanation fields, because they can trigger refusals.
- At most 16 union-type fields are allowed and compile cost grows quickly with them. We use at most 12. The first call with a new schema compiles a grammar and can be slower.
- Enum casing is not guaranteed, so normalise in code.
- Check stop_reason before parsing. A refusal or a max_tokens stop returns HTTP 200 with output that may not match the schema.
- The model returns the customer's own words, such as harbour wall or stainless. Mapping those words to coastal or a steel group is done in code.

## Injection policy

- The email text is untrusted data. It is passed to the model as clearly delimited quoted content, and the instructions say to extract only and to ignore any instruction found inside the email.
- The extraction call has no tools and sees no catalogue, price, stock, supplier or rule data.
- The schema has no field through which a price, SKU, status or approval could be set. Status comes only from the rules and the database.
- Instruction-like text inside an email never changes a rule, a price or a status. Evidence is grounded against the raw text, and anything that cannot be grounded is treated as missing.
- User text is never concatenated into SQL. Use parameterised or builder-style queries only. All output is escaped in the UI.
- Material-swap defence: R13 flags any A2 or A4 designation in the email that no line claims, which forces CLARIFICATION. Test it with the material-swap case. Claim only what is tested, and never describe the app as immune to prompt injection.

## Next.js 16 with Cache Components

- Cache Components are enabled in this version. Do not export dynamic, revalidate or fetchCache from routes.
- Do not fetch data in server components outside a Suspense boundary. Use route handlers for data.
- If the build complains and nothing else works, set cacheComponents to false in the Next config and tell Ak.
- next build no longer runs the linter. Run lint, the TypeScript check with no emit, the tests and the build as four separate commands.
- Use plain shadcn init with the Tailwind v4 and Turbopack setup. This was confirmed working in the rehearsal. The button font rendered as serif in the rehearsal and the cause was not checked, so check the font setup if the UI looks wrong.

## Supabase

- New tables need explicit grants. If you see the error "permission denied for table" followed by a table name, the grant is missing. The fix is to grant select, insert, update and delete on that table to the service_role, then notify PostgREST to reload its schema. Do not grant anything to anon or authenticated.
- schema.sql is one idempotent script: create if not exists, row level security enabled with no policies, grants to service_role only, CHECK constraints on status and non-negative columns (text columns with CHECK, not Postgres enums), a verification query at the end, and the schema reload notification. Ak reviews it and runs it in the Supabase SQL editor. Do not use the Supabase MCP server.
- The supabase-js client is created with persistSession, autoRefreshToken and detectSessionInUrl all off, in a module that imports server-only.
- The lookup is an exact equality query. No fuzzy search, no trigram, no vectors.

## Vercel

- Hobby plan, region lhr1 set in vercel.json, a 60 second maximum duration on the analyze route (use whichever mechanism the build accepts, then verify it in the live deploy).
- Deploy only from main. Ak pushes. Ak adds the three environment variables in the Vercel dashboard, Production only.
- A daily cron on the health route is best effort only (Hobby runs it once a day with up to an hour of drift). It is a late, low-priority task and never a gate. The health route runs a tiny database read.
- If a deployment ever shows Blocked, tell Ak. The fix that worked before was Redeploy from the dashboard.

## Domain rules

The rule table, code-side steps, tests, seed spec and eval set are in planning/01-spec-rules-tests-seed-eval.md. Do not invent rules. Do not change a rule without a test. The basis of each rule (house policy or supplier practice) is shown in the UI and the README. The rules do not replace engineering sign-off.

## How to work

- Plan before code. Write failing Vitest cases from the test table first, show them red, then implement.
- One change at a time. Run the relevant check after each. Commit at each gate with a message that says what was verified.
- Never use git add with a dot or -A. List files explicitly, and check git status for package.json and the lockfile before every push. Ak runs git push. Do not change the git identity. Keep the Co-Authored-By trailer on commits. Do not commit the local settings file in the .claude folder, and confirm with git status that it is ignored before the first commit.
- At each gate run Get-Date and append the time and elapsed minutes to planning/CLOCK.md.
- If a command is blocked by a permission rule, do not look for a way around it. Say so and ask Ak.
- When something fails, diagnose before editing. Say what you think the cause is and how sure you are.
- If a requirement cannot be met in the time left, say so and propose the next cut from the cut ladder in planning/02-run-sheet-protocols-readme-email.md. Do not leave anything half built.
- Keep code simple: no abstraction without a second use, no any type, no dead code, small files, names that say what they do.
- A separate advisor chat reviews your work during the window. It cannot talk to you directly. When Ak relays a point, judge it on its merits and, if you reject it, say why in one line.
- UI copy is plain language for a sales engineer. Label the catalogue "synthetic demo data". Show a "do not paste personal data" notice. Show each line's rule, evidence and, for READY lines, the as-of date.
