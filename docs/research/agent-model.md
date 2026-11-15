# Which model should power the Lazuli agent?

Research date: 15 Nov 2026. Prices are USD per 1M tokens, standard (non-batch) tier, short-context rates.

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
