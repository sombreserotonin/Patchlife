# Costs, and moving off subscription AI

Researched 21 Oct 2026 by four researchers and a workload analyst, with every key claim re-checked at its source by an independent fact-checker. Figures marked *estimate* are ours; everything else cites a source below. Prices are USD unless marked A$.

## Summary
- **The RX 9070 XT can take over the narrow language steps, not the unattended agent work.** It runs models that are good enough to read a support table row and fill in a record, classify a correction issue or flag a suspicious record. It cannot reliably replace Claude for the daily build, code review, audits that need judgement, or the coordinating session.
- **The biggest saving is not the GPU.** Most recurring runs need no model at all: merging, nightly re-verification, change detection, the site build, reports and the heartbeat. Turned into plain scripts on GitHub Actions, they cost nothing for a public repo.
- **Planned end state:** scripts do the routine work; a local model (or a cheap API call) fills in records; a frontier model is used only to build features and for occasional audits. *Estimate:* about US$5 to 15 a month plus feature-building sessions, against about US$50 to 120 a month at list-price equivalents for the current all-agent setup.
- **Not urgent.** Do it after M2 is live. Getting it working comes first, as agreed.

## Where the cost goes today
The owner pays a flat subscription, so these are list-price equivalents from the session metadata, not money spent.

| Run | Cost |
| --- | --- |
| `Crawl` data session adding 12 to 60 records | US$2.07 to 2.49 |
| Triage of a source that turned out unusable (Arlo) | US$1.21 |
| Verifier run on 2 records | US$0.71 |
| Daily build with nothing to do | US$0.16 |
| Coordinating session with multi-agent reviews (21 Oct) | over US$80 by midday |

Two lessons:
- Small runs are dominated by fixed reading: every session reads about 62 KB of CLAUDE.md, memory, TASKS, ROADMAP, PLAN and RUNBOOKS before doing anything.
- Large multi-agent reviews are by far the most expensive thing we do. They found real bugs (for example a site build that could delete the folder it was run from), but routine changes need one reviewer, not dozens.

*Estimate* for a steady month on the current setup once the site is built: daily build US$5 to 40, nightly data about US$21 to 38, audits US$15 to 25, corrections US$5 to 10, so about US$50 to 120, plus US$40 to 100 or more for each coordinating session.

## What needs a model at all
About 60 to 70% of today's recurring agent runs need no model (*estimate* from the workload map).

| Job | Model needed | Replacement |
| --- | --- | --- |
| Merge eligible PRs (daily build housekeeping) | No | A script: list PRs with `gh api`, apply the CLAUDE.md rules, merge |
| Nightly re-verify (`--due 60 --limit 40`) | No | Scheduled job; open a PR only when something changed |
| Change detection on known sources | No | Store a hash per URL (today `text_sha256` covers all of a record's pages together, so it can't say which page changed) |
| Source triage (robots.txt, status, bot challenge) | No | A triage script using the polite fetcher |
| Site build and deploy, Measures report, heartbeat, weekly digest | No | Already scripts; run them on Actions |
| Add records from a source | Light | Per-source table parsers write the YAML; a small model fills classification fields and picks quotes by row number |
| Data-correction and add-model issues | Light | A script resolves the record and re-runs the verifier; a small model classifies what's left |
| Stale record repair | Light | Search the registry for the old quote first; a small model answers "same statement?" |
| A8 audit | Heavy | Mid-tier or frontier model, as one call, and a different model from the extractor |
| Building M2 to M7 features, security review | Heavy | Frontier model, interactively, only when building |
| Finding new sources | Heavy | Mid-tier model with web search, or the owner |

## Can the RX 9070 XT do it?
**Support is solid on Linux.** AMD's ROCm 10.1.0 (5 Oct 2026) lists the RX 9070 XT (gfx1201) as supported on Ubuntu 26.04.1, 24.04.5 and 22.04.5, RHEL and Windows 11 [1]. Ollama supports it through ROCm on Linux only; on Windows it uses Vulkan [2]. Windows ROCm had crash bugs on this card in 2026 [3], so Linux is the safer path.

**What fits in 16 GB** (16 GB GDDR6, 640 GB/s, 304 W board power [4]):
- gpt-oss-20b fits fully up to about 32k context; the full 128k needs about 17.9 GB [5]. Measured about 92 tokens a second through Ollama on ROCm [6].
- Qwen3 14B: about 52 tokens a second [6].
- A 27B to 32B dense model at 4 bits spills into system memory and drops to about 5 to 6.5 tokens a second, which is too slow [6][7].
- A 35B mixture-of-experts model with 3B active parameters stays usable at about 42 to 46 tokens a second with some expert layers kept in system memory, from 32k to 256k context [8].
- llama.cpp's Vulkan backend generated about 8% faster than ROCm on this card [9].

**Quality:**
- Models that fit consumer GPUs trail the frontier, and further than open models in general [10].
- Local agent loops break in fragile ways, for example empty tool arguments after a few turns until a chat-template setting was fixed [11]. Nobody is there to fix that at 6 am.
- Anthropic does not support routing Claude Code to non-Claude models [12], so our existing prompts would run unsupported on a local model.
- Vendor benchmark scores for the best small models look close to Claude, but they are full-precision numbers; at the 3 to 4 bits that fit this card, quality on our tasks is unmeasured. No benchmark measures what we need most: picking the right date and an exact quote from a messy support page.

**Verdict:** use it for extraction, triage and first-pass audit flags, behind the checks we already have (exact-quote match, the quote must state the date, schema validation, CI, a second reader). Do not use it for the daily build, review, or anything that merges. Re-assess every six months.

**What it saves:** little in cash. *Estimate:* a 10-minute job costs about A$0.03 of electricity; a month of nightly jobs about A$1. Haiku 5.5 through the API would cost about the same. The real value of the local card is needing no API key or billing account, no per-call spend, and keeping going if the subscription lapses.

**Your machine:** Windows, 64 GB of DDR4, RX 9070 XT (owner, 21 Oct 2026).
- On Windows, use the Vulkan backend: Ollama runs this card through Vulkan on Windows [2], and Windows ROCm had crash bugs on it in 2026 [3]. Vulkan was also the faster backend in the Linux tests above [9].
- 64 GB lets a mixture-of-experts model keep its expert layers in system memory, as in the 35B offload result above [8]. That result was not measured on DDR4, which is slower than current memory, so offload speed on your machine is unknown until the gold-set test measures it. Models that fit fully in 16 GB don't depend on it.
- Linux stays the better-tested path if you ever dual-boot, but it isn't needed.

**Set-up when the time comes:**
- llama.cpp `llama-server`, Vulkan build, pinned to a known-good version and re-benchmarked before upgrades [13].
- JSON-schema-constrained output, so the model fills fields and code writes the YAML.
- The server on 127.0.0.1 only.
- Run it from Windows Task Scheduler as a normal (not administrator) user, with "Run task as soon as possible after a scheduled start is missed" and "Wake the computer to run this task" ticked [14]. Both are off by default, and waking works from sleep only, not from a full shutdown. Not as a GitHub self-hosted runner: GitHub advises against self-hosted runners on public repos, because a fork PR could run code on your PC [15].
- The job pushes a `claude/` branch and opens a PR with a fine-grained GitHub token limited to this repository (contents and pull requests only). Creating that token is a human gate (a secret).
- **Before trusting it:** re-extract the 122 audited records from their pages and score exact quote, exact date and the right model and region. Only switch if it matches.

## Cheaper hosted options
Anthropic prices, checked 21 Oct 2026:
- **Plans:** Pro US$20 a month; Max 5x US$100 and Max 20x US$200 a month, with a 5-hour session limit and a weekly limit [16][17].
- **API credits:** Max 5x includes US$100 and Max 20x US$200 a month of Claude API credits. They cover the API and the Agent SDK, not Claude Code, and expire each billing cycle [18]. If you are on Max, this is the biggest lever: run the scheduled single-shot jobs (extraction, re-checks, audits) through the API under these credits, and keep Claude Code for building.
- **API per million tokens (input/output):** Haiku 5.5 $0.10/$0.50 (prompts up to 100k tokens), Sonnet 5.5 $2/$10, Opus 5.5 $4/$20. The Batch API halves these [19].
- *Estimate:* extracting a 60-row source costs under US$0.01 on Haiku 5.5; an A8 audit about US$0.27 on Sonnet 5.5. A month of 15 extractions, 15 audits and 5 corrections costs about US$2 to 11.

Free tiers are not worth planning on:
- GitHub Models was retired on 30 July 2026 [20].
- Cloudflare Workers AI gives 10,000 Neurons a day free [21], enough for a small non-sensitive job.
- Gemini and OpenRouter free limits could not be confirmed from their own pages and have been cut before.

Other providers' open-model prices (DeepSeek, OpenRouter) came only from search summaries, so treat them as provisional until someone opens the live pages.

## Free infrastructure
- **Actions minutes:** GitHub Actions is free on standard runners for public repos [22]. Limits: 6 hours a job and 20 concurrent jobs [23].
- **Schedules are best effort:** they can be delayed or dropped under load, especially on the hour, and switch off after 60 days without repository activity [24]. One July 2026 report had a new public repo's daily job running 8 to 14 hours late [25]. A scheduled run needs a watchdog: flag 48 hours without a successful nightly run.
- **Runners use Azure IP ranges** [26], and some sites block them [27]. Before moving crawling to Actions, probe each evidence host once from a runner. A host that blocks it gets verified from the home PC or dropped (D18), never routed around with proxies.
- **Probe result (21 Oct 2026, `Probe hosts` run 39695382968):** all six evidence hosts (support.ezviz.com, www.ezviz.com, www.gl-inet.com, support.google.com, ring.com, www.tp-link.com) allowed PatchlifeBot in robots.txt and returned HTTP 200 to a GitHub runner. Probe again when a new host is added.
- **Pages:** fits the static site; Pages may not host a business or SaaS, so the paid feed and reports need other hosting later [28].
- **Bot PRs and CI:** PRs opened with the built-in `GITHUB_TOKEN` don't get normal CI runs. Either the job runs validate and test itself before opening a PR, or it uses a GitHub App or fine-grained token, which is a secret and so a human gate.
- **Actions terms:** they bar using runners for work unrelated to the project [29]. A crawl that feeds this repo's own records should be fine, but it is our reading, not GitHub's.

## The pivot, in stages
| Stage | When | What | Needs from you |
| --- | --- | --- | --- |
| 0 | Now | Keep building. When cost starts to matter, keep multi-agent reviews for risky code. Note your plan tier and weekly usage once a week. | Done: on Max, aiming for Pro |
| 1 | After M2 | Move the no-model jobs to Actions in one protected PR: merge script, nightly re-verify with per-URL change detection, heartbeat, Measures report. Probe host reachability first. | Merge the protected PR; maybe a GitHub App or token (secret) |
| 2 | M3 | Per-source table parsers for Ring, Google and TP-Link, so new rows become candidate records by code. Harden the validator (see below). | Nothing |
| 3 | M3 | A gold-set test of the 9070 XT (and of Haiku 5.5) on the 122 audited records. Switch extraction to whichever passes. Audits stay on a hosted model, different from the extractor. | Linux on the PC, or API credits set up (an account and terms: human gates) |
| 4 | After M3 | Move to Pro once the checks under "Getting to Pro" hold, and use a frontier model only when building features. | Change the plan |

## Getting to Pro
You are on Max and want to move to Pro (US$20 a month) once the pivot allows it. Max 5x gives five times Pro's usage [16], and Pro has no included API credits [18]. That target changes two things:
- **Stage 1 matters most.** Once merging, re-verification and reports run on Actions, the daily build and the nightly task stop spending session usage on routine work.
- **Stage 3 favours the 9070 XT.** On Pro, the Haiku route means pay-per-use API spend, which needs an account and money (human gates). The local card needs neither.

Step down when all of these hold:
1. Stages 1 and 2 are live, and the nightly task opens a session only when a page has changed.
2. Extraction runs on the 9070 XT, or on pay-per-use API calls if you approve the spend.
3. For two weeks, weekly usage on claude.ai stays under about a fifth of your Max limit (*estimate*, since Max 5x is five times Pro), with room for a feature-building session.
4. No coordinating sessions with multi-agent reviews in that time.

If usage runs out on Pro, scheduled runs are rejected until the window resets (usage credits are off, #7). The daily build and nightly task then skip a run; nothing breaks.

## Found along the way
- **Validator gap (closed):** `mentionsDate` accepted both day/month/year and month/day/year, so "3/4/2027" passed for both 3 April and 4 March. Google's quotes are month/day ("10/5/2021" is 5 October) and TP-Link's are day/month. Source registry entries now give a `date_order`, and an ambiguous numeric date on a URL without one fails validation (DATA-POLICY, Quotes).
- **Two more cheap validator rules (in place)** that make a weaker extractor safer: every record's model name or an alias appears in a quote, and no alias is shared by two records of the same brand, except region-date splits of one product (D33). All 338 records passed when they were added.
- **Before any automation of commercial work on a consumer plan:** Anthropic's consumer terms forbid scripted access except through an API key or where Anthropic explicitly permits it [30]. Scheduled tasks in claude.ai are a first-party feature, but whether a commercial product's pipeline fits the consumer terms is a legal reading for you.

## Sources
1. AMD ROCm compatibility matrix: https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html
2. Ollama GPU support: https://docs.ollama.com/gpu
3. ROCm Windows gfx1201 bug: https://github.com/ROCm/legacy-rocm-build/issues/6461
4. AMD RX 9070 XT specifications: https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html
5. llama.cpp gpt-oss guide: https://github.com/ggml-org/llama.cpp/discussions/15396
6. RX 9070 XT local LLM benchmark: https://github.com/hirokuze/local-llm-benchmark-rx9070xt
7. LM Studio issue 1306 (Vulkan against ROCm, spill to CPU): https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1306
8. MoE offload configurations on the RX 9070 XT: https://github.com/bhat-sahab/llama-inference/blob/main/knowledge-base/02-best-configs.md
9. llama.cpp Vulkan and ROCm results: https://github.com/ggml-org/llama.cpp/discussions/15021
10. Epoch AI, consumer GPU model gap: https://epoch.ai/data-insights/consumer-gpu-model-gap
11. Local agent tool-call failure: https://github.com/earendil-works/pi/issues/3325
12. Claude Code LLM gateways: https://code.claude.com/docs/en/llm-gateway
13. llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
14. Windows Task Scheduler, start when available and wake to run: https://learn.microsoft.com/windows/win32/taskschd/taskschedulerschema-startwhenavailable-settingstype-element and https://learn.microsoft.com/windows/win32/taskschd/taskschedulerschema-waketorun-settingstype-element (systemd timers, if you use Linux: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)
15. GitHub, hardening self-hosted runners: https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners
16. Claude pricing: https://claude.com/pricing
17. About the Max plan: https://support.claude.com/en/articles/11049741-about-claude-s-max-plan
18. API credits for subscribers: https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers
19. Anthropic API pricing: https://platform.claude.com/docs/en/about-claude/pricing
20. GitHub Models retired: https://github.blog/changelog/2026-07-30-github-models-is-now-retired/
21. Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
22. GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
23. GitHub Actions limits: https://docs.github.com/en/actions/reference/limits
24. Scheduled workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
25. Late schedules on a new repo: https://github.com/orgs/community/discussions/201738
26. GitHub-hosted runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
27. Sites blocking Actions IPs: https://simonwillison.net/2025/Feb/23/tailscale-github-actions/
28. GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
29. GitHub terms for Actions: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions
30. Anthropic consumer terms: https://www.anthropic.com/legal/consumer-terms
