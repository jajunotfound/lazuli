# Which model should power the Lazuli agent?

Research date: 15 Nov 2026. The budget is zero, so the zero-cost options come first. The paid comparison follows in Part 2, for later.

---

# Part 1: Zero-budget options

## Short answer

You can't get one free option that is good, reliable and stays free as the app grows. A free setup can still work if you stack the options:

1. **Default: Gemini API free tier** (Gemini 3.8 Flash or a Flash-Lite model), called through a **Cloudflare Worker on the free plan** so the key stays server-side. This is the best quality that costs nothing, but it has unpublished per-project limits, Google trains on the data, and it cannot legally serve users in the EEA, UK or Switzerland.
2. **Hosted overflow: Cloudflare Workers AI**, from the same Worker. 10,000 free "neurons" a day works out to roughly 150 to 240 agent calls a day on small open models. It is the fallback when Gemini returns 429, and the default for EEA/UK/CH visitors.
3. **Bring your own key** for anyone who wants more: a one-click **OpenRouter** connect (OAuth PKCE, the user pays from their own credits), or a pasted Gemini, Anthropic or OpenAI key. A user's own free Gemini key gives that user their own free quota, which costs us nothing.
4. **In-browser model (WebLLM + Qwen2.5-Coder 3B or 7B)** as an opt-in "offline / unlimited" mode for people with a decent GPU. It is free with no limits, but it is a 2 to 5 GB download, has a 4K-token context, and gives weaker results. It suits small edits better than whole new scenes.

When the shared free quotas run out, the app falls back to options 3 and 4 instead of breaking.

## 1. In-browser models (WebGPU)

### What is available right now

WebLLM (MLC) prebuilt model list, read from `src/config.ts` on GitHub `main`, 15 Nov 2026:

| Model (WebLLM id, q4f16) | VRAM needed | Context | Notes |
|---|---|---|---|
| Qwen2.5-Coder-1.5B-Instruct | 1.6 GB | 4,096 | Coder-tuned. Probably too weak for an unfamiliar DSL (unverified) |
| **Qwen2.5-Coder-3B-Instruct** | **2.5 GB** | 4,096 | Flagged "low resource" in the config, so it runs on most laptops. Best small pick |
| **Qwen2.5-Coder-7B-Instruct** | **5.1 GB** | 4,096 | Largest coder model in WebLLM. Needs a GPU with ~6 GB+, or Apple Silicon with 16 GB RAM |
| Qwen3-4B / Qwen3-8B | 3.4 / 5.7 GB | 4,096 | Newer general models. Thinking mode makes them slower |
| Qwen3.5-4B / Qwen3.5-9B | 3.9 / 6.4 GB | 4,096 | Newest Qwen in WebLLM; general, not coder-tuned |
| Llama-3.2-3B-Instruct | 2.3 GB | 4,096 | General. Weaker at code than Qwen Coder 3B (unverified, by reputation) |
| Phi-4-mini-instruct | 3.4 GB | 4,096 | Decent at reasoning for its size |
| gemma-4-E2B-it | 3.4 GB | 4,096 | Newest Gemma in WebLLM |
| Phi-3.5-vision-instruct | 4.5 GB | 4,096 | The only vision model listed. Not good enough for "match this screenshot" (unverified) |

There is no Qwen3-Coder build in WebLLM. transformers.js v4 (Hugging Face, rewritten WebGPU backend built with the ONNX Runtime team) also runs ONNX models in the browser. Hugging Face reports ~60 tokens/s for GPT-OSS 20B at q4f16 on an M4-class Mac, but that is a 12 GB+ download. Small Qwen ONNX builds exist as community uploads, but I couldn't confirm a maintained Qwen2.5-Coder ONNX build for transformers.js.

**Download size:** roughly the VRAM figure minus the KV cache. That is about 1.7 to 2 GB for the 3B model and about 4 to 4.5 GB for the 7B model (estimate). The first load takes about 1 to 3 minutes on a 200 Mbps line and 5 to 12 minutes at 50 Mbps. WebLLM then caches the weights in the browser (Cache API, IndexedDB or OPFS), so later loads only pay the GPU warm-up, which takes several seconds (estimate).

**Speed:** The WebLLM paper reports ~90 tokens/s for a 4-bit 3B model on an M3 laptop and ~41 tokens/s for Llama 3.1 8B on an M3 Max. There are no published M1/M2 or mid-range Windows GPU figures for these models. Rough estimate: 3B at 30 to 70 tokens/s and 7B at 12 to 30 tokens/s on M1/M2 or a mid-range discrete GPU, and much less on integrated Intel graphics. Reading a ~3K-token prompt also adds a few seconds per call. A 600-token reply would take about 10 to 20 s on a 3B model and 20 to 50 s on a 7B model, which is well over the 5 s target. Streaming helps, because lines appear as they are written.

**Browser support (caniuse, usage data from Oct 2026):** WebGPU works by default in Chrome and Edge 113+, Chrome for Android, and Safari on iOS 26+. Desktop Safari 26 to 27 has partial support, and Firefox has it only behind a flag according to caniuse. That covers about 87% of global users, but iPhones cannot run a multi-GB model in practice.

**The context window is the real blocker.** Every WebLLM prebuilt model is compiled with a 4,096-token context. Our call needs ~4,000 tokens of spec + 300 to 1,500 tokens of canvas + up to 600 tokens of output, which doesn't fit. `ChatOptions.context_window_size` exists, but a GitHub issue reports that the prebuilt WASM files are compiled at 4,096, so going higher means compiling custom model libraries with `mlc_llm compile` (unverified). For a local model, the realistic plan is a **cut-down spec of ~1,500 to 2,000 tokens** (core grammar + 3 short examples) and a cap on canvas size.

**Constrained decoding:** WebLLM supports JSON mode and custom JSON schemas, using XGrammar under the hood. XGrammar itself supports EBNF grammars, but the WebLLM README doesn't document an EBNF option, so it is unclear whether we could force output to follow Lazuli's grammar directly (unverified). A JSON schema can guarantee the *structure*, for example an array of `{op, args}` calls, but it can't guarantee the GLSL inside code layers. Our own parse-and-retry loop still has to do that work.

**Can a 3B or 7B model reliably write a 10 to 60 line program in our DSL?** No direct evidence. My judgement (unverified):
- Small edits ("warmer and slower", change a palette, tweak an amount): likely fine with a 7B model, often fine with a 3B model, especially if the model returns a few changed lines.
- New scenes with good composition and taste, or new GLSL SDF bodies: expect frequent invalid syntax, flat compositions and wrong maths. ShaderMatch (2025) found that even top models produced broken GLSL ~31% of the time, and small models do worse.
- So the local model is a free fallback with a clear "lower quality" label, not the default.

**Also worth watching:** Chrome's built-in Prompt API (`LanguageModel`, MDN updated 10 Nov 2026) runs a model the browser already has, with no per-site download. MDN marks it "limited availability". I didn't check which browsers ship it on normal web pages, or its context size and quality.

## 2. Free hosted tiers

| Provider | Free models that fit | Free limits | Card needed? | Trains on your data? | Production / commercial use | Key server-side for free? |
|---|---|---|---|---|---|---|
| **Google Gemini API free tier** | Gemini 3.8 Flash, 3.5 / 3.1 / 2.5 Flash-Lite, Gemini 4 Hydrogen (pricing page lists "Free of charge" on the Standard tier for all of these) | **Not published.** The rate-limits page sends you to AI Studio for per-project numbers. Third-party reports from 2026 range from 5 RPM / 100 RPD to 15 RPM / 1,500 RPD (unverified). Limits are per Google Cloud project, not per key | No | **Yes.** The pricing page says "Used to improve our products: Yes" for the free tier. Terms (effective 23 Mar 2026): humans may review inputs/outputs | Terms say it is for developers building for "professional or business purposes". **Apps serving users in the EEA, Switzerland or UK must use Paid Services.** Users must be 18+, and API clients aimed at under-18s are not allowed | Yes, through a Cloudflare Worker (below) |
| **Cloudflare Workers AI** | gemma-4-26b-a4b-it, llama-3.1-8b-instruct-fp8-fast, gpt-oss-20b, gpt-oss-120b, qwen2.5-coder-32b-instruct, etc. | 10,000 neurons/day shared across models (resets 00:00 UTC). For our 5K-in / 600-out call: ~240/day on Llama 3.1 8B fast, ~160/day on Gemma 4 26B-A4B, ~93/day on gpt-oss-20b, ~50/day on gpt-oss-120b, ~28/day on Qwen2.5-Coder-32B (my maths from the pricing page, updated 12 Nov 2026) | No for the free plan (Workers Paid is $5/mo; card status unverified) | Cloudflare says it does not train on customer data (from memory, unverified today) | Yes, it is a normal product with a free allocation | Yes: call it from the Worker via the AI binding, with no key to manage |
| **Groq** | gpt-oss-120b, gpt-oss-20b, qwen3.8-27b | The docs table (labelled "Developer plan base limits") gives 30 RPM, 1K RPD, **8K tokens/min**, 200K tokens/day. Free plan limits are visible only in the console (unverified). At 8K TPM, our ~5.6K-token request allows **~1 call per minute for the whole app** | Unverified | Docs: inference data not kept by default, optional zero data retention; training not allowed without permission (agreement quoted by third parties, unverified) | Not stated; check terms | Yes, through a Worker |
| **OpenRouter `:free` models** | ERNIE-5.5-Flash-Preview (pitched for coding), Ling 3.2 Flash (text + image). Thin list | 20 RPM and **50 requests/day per account** (1,000/day after buying $10 of credits once). Limits are per account, so they are shared by all our users | No | Depends on the upstream provider; free endpoints often log prompts (unverified) | Allowed, but 50/day makes it useless as a shared backend | Yes, but pointless at 50/day. **Most useful as BYOK** (see below) |
| **Mistral "Experiment" plan** | Mistral models incl. Devstral/Codestral (unverified which) | Not published; see the console. Old 1 req/s figures are stale | Phone verification, no card (third-party) | **Yes**, by default (Mistral help article) | Unclear; intended "to try the API" | Yes, through a Worker |
| **Cerebras** | gpt-oss-120b, qwen-3.8-27b | Free *trial* only: $5 credit, expires after 30 days | **Yes, card required** | n/a | n/a | **Not a zero-cost option** |
| **GitHub Models** | n/a | n/a | n/a | n/a | n/a | **Retired 30 July 2026** (docs.github.com) |
| **Hugging Face Inference Providers** | Many | Free accounts reportedly lost their monthly credits in Oct 2026 (third-party). HF's docs still say $0.10/month | n/a | n/a | n/a | **Not usable** in practice (unverified; $0.10 would be tiny anyway) |

### Keeping the key server-side for free: a Cloudflare Worker proxy

Cloudflare Workers free plan (limits page, updated 13 Nov 2026): 100,000 requests/day, **10 ms CPU per request**, but time spent waiting on `fetch()` is not counted, and a Worker that is streaming a response stays alive. A pass-through streaming proxy (check origin, check a simple rate limit, forward to Gemini, pipe the stream back) fits within 10 ms of CPU as long as it doesn't parse every chunk. The same Worker can call Workers AI directly as the fallback. It can also read the visitor's country from Cloudflare's request data, so EEA/UK/CH users can skip Gemini's free tier.

Exposing the free Gemini key in the browser is not an option: anyone could copy it and use up the whole project quota.

## 3. Bring your own key (BYOK)

It costs us nothing, and power users get the best models.

- **OpenRouter OAuth PKCE** (docs, checked 15 Nov 2026): the user clicks "Connect OpenRouter", logs in, and the app receives a key billed to *their* credits. It works fully in the browser with no client secret. A single integration gives users access to Claude Haiku 5.5 and Sonnet 5.5, GPT, Gemini and the rest. This is the best BYOK experience.
- **Pasted keys:**
  - **Gemini:** a user's own free Gemini key gives them their *own* free quota. This is a good "unlimited for free" path to suggest to heavy users outside the EEA/UK/CH.
  - **Anthropic:** browser calls work with the `anthropic-dangerous-direct-browser-access: true` header, which exists for exactly this BYOK case.
  - **OpenAI:** browser calls were not checked.
- Rules: keep the key only in the user's browser (localStorage, with a clear "stored on this device only" note), never send it to our Worker, and give them a "forget key" button.

## 4. Recommended zero-cost setup

```
request ──▶ Cloudflare Worker (free)
              ├─ visitor outside EEA/UK/CH ─▶ Gemini free tier (3.8 Flash; Flash-Lite as backup)
              ├─ 429 / quota gone, or EEA/UK/CH ─▶ Workers AI (Gemma 4 26B-A4B or Llama 3.1 8B fast)
              └─ Workers AI daily neurons gone ─▶ tell the client "free quota used up"
client ──▶ offers: [Connect OpenRouter] [Use my Gemini/Anthropic key] [Run locally (beta, 2–5 GB)]
```

- **Model routing stays simple:** one prompt, one parse-and-retry loop. Only the endpoint changes.
- **Per-user fairness:** limit each visitor (for example 30 agent calls/day) so a single heavy user can't use up the shared quota. Counting in Workers KV or a Durable Object is possible on the free plan within its limits (not checked).
- **Prompt size matters even when free:** Gemini's free tier and Groq both count tokens per minute, and Workers AI charges neurons per token. Keep the spec tight, and send diffs for edits.
- **The local model gets its own short spec** (~1.5 to 2K tokens) because of the 4K context.

### Trade-offs

- **Data:** Gemini free tier inputs (prompts and canvas code) may be used for training and read by human reviewers. Say so in the UI or the privacy note.
- **Legal:** Gemini's free tier cannot serve EEA/UK/CH users. The geo-routing above handles that.
- **Quality varies by path:** Gemini Flash is good; Gemma 4 and Llama 8B on Workers AI are noticeably weaker; local 3B/7B models are weaker still. Show which engine produced a result.
- **Latency:** Gemini and Workers AI should land within a few seconds (not measured). The local model takes 10 to 50 s for a full reply.

### What breaks if it gets popular

- **Gemini free quota** is per project and unpublished. Third-party figures suggest somewhere between ~100 and ~1,500 requests/day. At even a few hundred active users a day, expect daily 429s by midday (estimate).
- **Workers AI** adds only ~150 to 240 calls/day on top of that.
- **Workers** itself allows 100,000 requests/day, which is not the bottleneck.
- After that, free users get only BYOK or the local model. That is the point where money becomes necessary. The cheapest paid fix is Claude Haiku 5.5 or GPT-6 Luna at about **$0.44 per 1,000 calls** (Part 2), or paying for Gemini, which also lifts the EEA/UK restriction and stops the data use.

### Zero-budget sources (all checked 15 Nov 2026)

| Source | Date on page |
|---|---|
| github.com/mlc-ai/web-llm `src/config.ts` and README (main branch) | live repo |
| WebLLM paper (arXiv 2412.15803) | Dec 2024 |
| webllm.mlc.ai API reference (ChatOptions); GitHub issue on 4,096-token compiled context | undated / unverified |
| huggingface.co/blog/transformersjs-v4 | 2026 |
| caniuse.com/webgpu | usage data Oct 2026 |
| MDN `LanguageModel` | modified 10 Nov 2026 |
| aistudio.google.com/docs/pricing (free tier and "used to improve" rows) | undated, read 15 Nov 2026 |
| aistudio.google.com/docs/rate-limits | undated; no per-model free numbers |
| aistudio.google.com/docs/terms | effective 23 Mar 2026 |
| developers.cloudflare.com/workers-ai/platform/pricing | updated 12 Nov 2026 |
| developers.cloudflare.com/workers/platform/limits | updated 13 Nov 2026 |
| console.groq.com/docs/rate-limits; console.groq.com/docs/your-data | undated |
| openrouter.ai/docs (limits; OAuth PKCE); openrouter.ai/models free filter | undated, read 15 Nov 2026 |
| inference-docs.cerebras.ai/support/rate-limits | undated |
| docs.github.com/en/github-models (retirement notice) | retired 30 Jul 2026 |
| help.mistral.ai Experiment plan article | undated |
| Hugging Face pricing: third-party reports (usagepricing.com, 15 Oct 2026) vs HF docs | conflicting |

---

# Part 2: Paid options (for when there is a budget)

Prices are USD per 1M tokens, standard (non-batch) tier, short-context rates.

## The job, in numbers

- Input per call: ~4,000-token system prompt (language spec + examples, identical every call, cacheable), ~1,000 tokens uncached (current canvas code + user message).
- Output: 10 to 60 lines of Lazuli code, call it ~600 tokens.
- Must parse and compile first time, have decent visual taste, write small GLSL SDF bodies, and stream a usable result in under ~5 s.
- Later: image input ("make it look like this screenshot").

The shape matters: this is short-output, cache-heavy, latency-sensitive work. Output tokens dominate the bill on every model, and any hidden "thinking" tokens are billed as output too. So the two biggest levers are (1) which model, and (2) how much it is allowed to think.

## Sources

| Source | What it gave | Date checked |
|---|---|---|
| `claude-api` skill (bundled model table, cached 2026-11-03) + platform.claude.com/docs/en/about-claude/pricing | Claude model IDs, prices, cache rates, thinking/effort controls | 15 Nov 2026 |
| developers.openai.com/api/docs/pricing and /api/docs/models | OpenAI prices, reasoning-effort options, image input | 15 Nov 2026 |
| aistudio.google.com/docs/pricing (redirect from ai.google.dev pricing) | Gemini prices incl. scheduled price rises | 15 Nov 2026 |
| api-docs.deepseek.com/quick_start/pricing | DeepSeek prices, peak/off-peak, vision | 15 Nov 2026 |
| alibabacloud.com/help/en/model-studio/model-pricing (Singapore, "last updated 12 Nov 2026") | Qwen prices | 15 Nov 2026 |
| artificialanalysis.ai leaderboards / comparison pages | Rough throughput figures | 15 Nov 2026, snapshots disagree |
| ShaderMatch (ICSE LLM4Code 2025), Shadereval (Hugging Face) | Only GLSL-specific benchmarks found | papers from 2025 |

## Comparison table

"Cached" is the price of reading the cached system prompt. Latency is not measured by us; see the latency section.

| Model (ID) | Input | Cached input | Output | Vision | Notes on code / GLSL quality |
|---|---|---|---|---|---|
| **Claude Haiku 5.5** (`claude-haiku-5-5`) | $0.10 | $0.01 | $0.50 | Yes | Anthropic's fast, low-cost tier for high-volume work. Adaptive thinking on by default; can be turned off at effort `high` or below, or run at `low` effort. No GLSL benchmark found. Prices apply to prompts ≤100K tokens (ours are ~6K). Newer tokenizer counts ~30% more tokens for the same text than Haiku 4.5. |
| **Claude Sonnet 5.5** (`claude-sonnet-5-5`) | $2.00 | $0.10 | $10.00 | Yes | Anthropic's everyday coding/agent tier. Thinking can be switched off with `thinking: {type: "between_tools"}` (effort `high` or below) or run at `low` effort. Strong general coding; no GLSL-specific score found. |
| Claude Opus 5.5 (`claude-opus-5-5`) | $4.00 | $0.20 | $20.00 | Yes | Thinking cannot be disabled (effort is the only control, default `medium`). Overkill for 60-line outputs. |
| Claude Fable 5.2 (`claude-fable-5-2`) | $8.00 | $0.20 | $40.00 | Yes | Top model, thinking always on, built for long hard tasks. Wrong fit for an interactive editor. |
| GPT-6 Luna (`gpt-6-luna`) | $0.10 | $0.01 | $0.50 | Yes (page says all latest models take images) | OpenAI's "most efficient" model. Reasoning can be set to `none`. Same price as Haiku 5.5. No GLSL score found. |
| GPT-5.6 Luna (`gpt-5.6-luna`) | $0.20 | $0.02 | $1.20 | Not verified | Listed on pricing page, not on the models page. |
| GPT-6.1 Terra (`gpt-6.1-terra`) | $1.00 | $0.05 | $5.00 | Yes | Positioned for visual reasoning; reasoning can be `none`. Middle tier. |
| GPT-6.1 Sol (`gpt-6.1-sol`) | $2.00 | $0.10 | $10.00 | Yes | Near-flagship; minimum reasoning effort is `low` (no `none`), so it always thinks some. |
| GPT-5 nano (`gpt-5-nano`) | $0.05 | $0.005 | $0.40 | Yes (unverified on page) | Older generation, cheapest OpenAI option. Quality on an unfamiliar DSL is a concern (unverified). |
| Gemini 3.8 Flash | $0.75 (→ $1.50 on 1 Jan 2027) | $0.075 (→ $0.15) | $3.75 (→ $7.50) | Yes | Current Flash. Price doubles on 1 Jan 2027. Explicit cache also bills storage ($0.50 → $1.00 per 1M tokens per hour; ~$0.002/hr for our 4K prompt). |
| Gemini 3.5 Flash-Lite | $0.30 | $0.03 | $2.50 | Yes | |
| Gemini 3.1 Flash-Lite | $0.25 | $0.025 | $1.50 | Yes | |
| Gemini 2.5 Flash-Lite | $0.10 | $0.01 | $0.40 | Yes | Older; still listed, not marked deprecated. Quality on a new DSL unverified. |
| DeepSeek Flash (`deepseek-flash`, V4.1-Flash-1017) | $0.15 off-peak / $0.30 peak | $0.003 / $0.006 | $0.60 / $1.20 | Yes | Peak = 01:00-04:00 and 06:00-10:00 UTC weekdays. China-hosted API (consider data/residency policy). |
| DeepSeek V4 Pro (`deepseek-v4-pro`) | $0.66 / $1.32 | $0.022 / $0.044 | $1.98 / $3.96 | No | Text only, so no screenshot feature. |
| Qwen3 Coder Flash (`qwen3-coder-flash`, Alibaba Singapore) | $0.30 | not listed | $1.50 | No (text coder) | Code-specialised. Cache rate for this model not listed; the page's generic example is 10% of input for hits (unverified for this model). Version dates from July 2025, so it is an older model. |
| Qwen3.8 Flash (`qwen3.8-flash`) | $0.15 | not listed | $0.47 | Not verified | General model, not code-specialised. |

Not verified: GLSL or shader quality for any of the models above. No current benchmark covers them (see the benchmarks section).

## Cost per request

Typical call: 4,000 cached input tokens + 1,000 uncached input + 600 output. Steady state, so the cache is already warm (the one-off cache write is ignored: on Claude it is 1.25x input for a 5-minute cache, so about $0.0005 on Haiku 5.5 and $0.01 on Sonnet 5.5 each time the cache goes cold).

Formula: `4000 × cached + 1000 × input + 600 × output`, divided by 1M.

| Model | Per request | Per 1,000 requests | +1,000 thinking tokens per request adds (per 1,000) |
|---|---|---|---|
| GPT-5 nano | $0.00031 | $0.31 | +$0.40 |
| Gemini 2.5 Flash-Lite | $0.00038 | $0.38 | +$0.40 |
| **Claude Haiku 5.5** | **$0.00044** | **$0.44** | +$0.50 |
| GPT-6 Luna | $0.00044 | $0.44 | +$0.50 |
| DeepSeek Flash (off-peak / peak) | $0.00052 / $0.00104 | $0.52 / $1.04 | +$0.60 / +$1.20 |
| GPT-5.6 Luna | $0.00100 | $1.00 | +$1.20 |
| Qwen3.8 Flash (no cache assumed) | $0.00103 | $1.03 | +$0.47 |
| Gemini 3.1 Flash-Lite | $0.00125 | $1.25 | +$1.50 |
| Gemini 3.5 Flash-Lite | $0.00192 | $1.92 | +$2.50 |
| DeepSeek V4 Pro (off-peak / peak) | $0.00194 / $0.00387 | $1.94 / $3.87 | +$1.98 / +$3.96 |
| Qwen3 Coder Flash (no cache assumed) | $0.00240 | $2.40 | +$1.50 |
| Gemini 3.8 Flash (now / from 1 Jan 2027) | $0.00330 / $0.00660 | $3.30 / $6.60 | +$3.75 / +$7.50 |
| GPT-6.1 Terra | $0.00420 | $4.20 | +$5.00 |
| **Claude Sonnet 5.5** | **$0.00840** | **$8.40** | +$10.00 |
| GPT-6.1 Sol | $0.00840 | $8.40 | +$10.00 |
| Claude Opus 5.5 | $0.01680 | $16.80 | +$20.00 |
| Claude Fable 5.2 | $0.03280 | $32.80 | +$40.00 |

Take-aways:

- Output is 60 to 70% of the bill on every model. On Haiku 5.5, 600 output tokens cost $0.30 per 1,000 calls; the cached 4K prompt costs $0.04.
- Thinking can double or triple the cost and adds seconds of latency. For this job, keep it off or at `low` and measure whether quality actually needs it.
- Prompt caching matters most on the expensive models. Without caching, Sonnet 5.5 would be $12.20 per 1,000 instead of $8.40 (the 4K prompt at $2.00 instead of $0.10). On Haiku 5.5 it saves only $0.36 per 1,000, but it also cuts time to first token.
- At free-tier scale: 100,000 agent calls a month is about $44 on Haiku 5.5, about $840 on Sonnet 5.5, and about $200 on the tiered mix below.

## Latency

Not measured by us. Third-party snapshots (artificialanalysis.ai, 15 Nov 2026) disagree with each other:

- Claude Haiku 5.5: ~137 to 235 output tokens/s depending on effort setting.
- Gemini 3.8 Flash: ~125 to 336 tokens/s depending on page.
- GPT-6 Luna: ~118 to 121 tokens/s.

Their time-to-first-token figures (14 to 26 s) are taken at high reasoning effort on long benchmark tasks and include thinking time, so they say nothing about our case. Rough estimate for our case with thinking off: 600 tokens at 120 to 200 tokens/s is 3 to 5 s of generation plus well under a second to first token with a warm cache. That fits the ~5 s target, and since the output is line-based, streaming lets the canvas update partway through. With thinking on at `medium` or above, expect the 5 s budget to be blown on most models. **This must be measured on our own prompts before committing.**

## Benchmarks: what exists for shaders

- **ShaderMatch** (ICSE LLM4Code 2025): 467 GLSL function completions from Shadertoy. Even the best models of that time produced non-working code in ~31% of cases. It predates every model in the table above.
- **Shadereval** (Hugging Face): GLSL completion, also older.
- Artificial Analysis has an "interactive GLSL shader art" micro-eval, but it is a single checklist task, not a ranking.
- One prototype write-up (14islands) found that LLMs often produce GLSL syntax errors and that asking for a short plan first reduced compile failures. Anecdotal.

Nothing current ranks Haiku 5.5, GPT-6 Luna, Gemini 3.8 Flash and the others on shader work, and nothing covers a custom DSL like Lazuli's. **The only reliable answer is a small eval of our own** (below).

## Recommendation

**Default: Claude Haiku 5.5 (`claude-haiku-5-5`), thinking off or at `low` effort, streaming, system prompt cached.** About $0.44 per 1,000 requests.

Why:

- It is tied for cheapest among current-generation models (with GPT-6 Luna), with vision for the later screenshot feature and a 512-token minimum cache prefix that our 4K prompt clears easily.
- A short DSL with a spec and examples in the prompt plays to a small fast model's strengths: pattern-following, not deep reasoning. The parse-and-retry loop catches the misses.
- One provider (Anthropic) for both tiers keeps the SDK, streaming, caching and error handling the same.

**Escalate to Claude Sonnet 5.5 (`claude-sonnet-5-5`), thinking off (`between_tools`) or `low` effort, when:**

1. The output from Haiku fails to parse/compile after its one retry (escalate the retry instead of retrying Haiku twice).
2. The request is a new scene from scratch, an empty canvas, or a large rewrite, where taste and composition matter most.
3. The request includes an image (screenshot matching is a harder visual task).
4. The user taps a "try harder" or "regenerate" control.

Cost of a tiered mix, if ~20% of calls go to Sonnet: 0.8 × $0.44 + 0.2 × $8.40 ≈ **$2.03 per 1,000 requests**. Still under a quarter of all-Sonnet.

**Fallback provider:** GPT-6 Luna (same price, reasoning `none`, images) is the closest like-for-like if Haiku 5.5 under-performs in the eval or for redundancy. Keep the model call behind one small interface so a swap is a config change. DeepSeek Flash is cheap and has vision but has peak-hour pricing and a China-hosted API; Gemini 3.8 Flash costs ~7x Haiku now and doubles in January 2027.

**What not to use:** Opus 5.5 and Fable 5.2. Both always think, cost 40 to 75x Haiku, and are built for long autonomous tasks, not 60-line edits.

## Cost levers

1. **Prompt caching.** Put the language spec + examples first, byte-identical every call, with a `cache_control` breakpoint at its end. Put canvas code and the user message after it. No timestamps or session IDs in the system prompt. Check `usage.cache_read_input_tokens` is non-zero from the second request on. Caches are per model, so a Haiku + Sonnet setup keeps two caches; both are cheap to write at 4K tokens. The 5-minute cache stays warm as long as any user sends a request within 5 minutes; with few users, the 1-hour cache (2x write) may be worth it.
2. **Thinking / effort.** The biggest hidden cost and latency driver. Start with thinking off; turn it on only for the Sonnet escalation path, and only if the eval shows a gain.
3. **Parse-and-retry loop.** The local parser + compile check is free. Send back only the error lines and the failing snippet, not the whole conversation again. If 10% of calls need a retry, the bill grows ~10%; routing the retry to Sonnet adds ~$0.84 per 1,000 calls at a 10% retry rate but likely fixes more on the first retry.
4. **Edits as diffs.** For "make it warmer and slower", ask the model to return only changed lines or a small patch. Fewer output tokens is both cheaper and faster. (Optional; needs a patch format the app can apply.)
5. **Output cap.** Set `max_tokens` to cover thinking (if any) plus ~1,500 tokens of code, so a runaway reply is cut off.
6. **Batch API** (50% off on Anthropic) does not fit interactive use, but works for generating example scenes or running the eval.

## Next step: a small eval before committing

Build 25 to 40 real prompts (new scenes, small edits, GLSL code layers, a few with screenshots later). For each candidate (Haiku 5.5, GPT-6 Luna, Sonnet 5.5; thinking off vs `low`), record:

- first-try parse + compile rate, and rate after one retry;
- time to first token and time to full result;
- a quick visual score (1 to 5) from looking at the rendered canvas;
- tokens used (from the API's usage fields) to confirm the cost table.

If Haiku 5.5 reaches ~90% compile-after-retry and acceptable visuals on edits, ship the tiered setup above. If it struggles on new scenes only, keep it for edits and route all new scenes to Sonnet.

## Unverified or uncertain

- No shader/GLSL quality data exists for any current model; every quality judgment above is by model positioning, not measurement.
- Latency numbers are third-party snapshots that disagree; none reflect our prompt shape.
- Qwen cache rates for the listed models are not on the price page.
- GPT-5.6 Luna and GPT-5 nano image support was not confirmed on a model page.
- Gemini context caching rules (implicit vs explicit, minimum size) were not checked per model.
- OpenAI and Gemini prices include promotions or scheduled changes (Gemini rises 1 Jan 2027); re-check before launch.
