# Minute-0 brief

Paste the block below as the first message in Claude Code. Start Claude Code in the Claude tab (never the secrets tab), from C:\dev\quoteready, in plan mode, on Opus 5.5. Keep this file in the planning folder.

---

CLOCK START. I have 2 hours in total to build, deploy and submit. Check elapsed time at every gate. Do the next three steps in this order.

Step 1: run Get-Date and write the time to planning/CLOCK.md as the clock start.

Step 2: read the settings files in the .claude folder and tell me whether they deny reading any .env file and anything under C:\dev\secrets. Do not open any .env file or anything under C:\dev\secrets to check.

Step 3: read CLAUDE.md, planning/01-spec-rules-tests-seed-eval.md and planning/02-run-sheet-protocols-readme-email.md in full. They were written before the clock. Everything else (code, SQL, seed data, prompts) is written now, in this session. Note for the log: I also have a separate advisor chat that reviews your work and may suggest corrections. It never writes code, SQL or prompts for me. I will tell you whenever I relay a point from it, and you should judge it on its merits.

What we are building. QuoteReady, an RFQ tool for a UK fasteners distributor, for an algosoup take-home. The product is the refusal gate: the model reads a messy email and extracts a spec with evidence, code and a products table decide READY, CLARIFICATION or NO MATCH per line, and a human reviews. It must not look like a valve-search clone, so the rule that fired and the evidence behind each decision are the feature.

What I want from you right now is a plan, with no code yet. Use plan mode. The plan must cover:

1. The file and folder structure, and the order you will build in, matched to the gates in file 02. The scaffold must keep CLAUDE.md and the planning folder intact.
2. The extraction schema (field list, the nullable evidence pattern, how you stay under the union-field limit) and the verification steps after the model call, including the stop reason check and the one Sonnet retry.
3. The rules as pure functions, how severity precedence works (state explicitly the per-line gating, the RFQ-level severity merge, and the lookup path when standard and thread type are both missing, with no fuzzy search), the code-side steps (evidence normalisation, designation parser, standard inference, application detector), and the exact test cases you will write first.
4. The data model: the three tables and the changes listed in file 01, with the grants and the idempotent schema script.
5. The API routes and their error states.
6. The cut ladder: what you cut first if a gate slips by more than 5 minutes.
7. Your five biggest risks or assumptions, and how each will be checked. Say which are guesses.

Then stop and wait. I will review the plan and correct it before you write anything. Ask me at most three questions, and only if the answer changes the plan.

Constraints that matter most. No SKU, price or stock field in the extraction schema. Doubt ends in CLARIFICATION or NO MATCH. Rules apply per line: all pre-lookup rules run on each line and the strictest outcome wins, and only lines that pass the gate are looked up. The RFQ badge is the worst line. No .env access, no adding everything to git at once, no new dependency without telling me. Commands that need live keys are run by me in the secrets tab, not by you.

Gates (minutes from clock start). 25: live URL with the health route. 45: core rules tests green. 60: end-to-end slice working locally. 68: first eval run. 75: feature freeze. 100: live validation done. 115: submitted.
