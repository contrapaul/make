/**
 * v100 — Cloud baselines (Tab 4 "Local vs Cloud")
 * =================================================
 * Single source of truth for cloud model specs, pricing, and measured speeds.
 * All prices are USD per 1M tokens unless noted. Every authoritative number
 * carries a `source` id into CLOUD_SOURCES and an as-of date.
 *
 * UPDATE POLICY: when cloud pricing/specs change, edit ONLY this file —
 * the UI renders everything from these exports (blueprint §12 risk row 2).
 */

export const CLOUD_DATA_AS_OF = '2026-09-01';

/**
 * @typedef {Object} CloudModel
 * @property {string} id            Stable key used by the store/UI.
 * @property {string} vendor        Provider name (display).
 * @property {string} name          Model name (display).
 * @property {string} tierNote      Where it sits in its family ("flagship", "value tier", …).
 * @property {number} contextTokens Total context window (input + output), tokens.
 * @property {?number} maxOutputTokens Max output per request, tokens (null = not published).
 * @property {{inputUSD:number, outputUSD:number}} pricing Standard list price per 1M tokens.
 * @property {?string} pricingNote Promo/peak-off-peak/cache caveats for on-page footnote.
 * @property {?number} outputTps    Measured output speed (tokens/sec), first-party API.
 * @property {?string} speedSource  Source id for outputTps + conditions (effort mode, etc.).
 * @property {?number} ttftS        Time-to-first-answer-token in seconds (may include "thinking").
 * @property {?string} ttftNote     Caveat on TTFT (reasoning effort dependence, provider spread).
 * @property {?{score:number, rank:string}} intelligenceIndex Artificial Analysis Intelligence Index.
 * @property {string[]} highlights  Short cited claims for the comparison table narrative rows.
 * @property {string[]} sources    Source ids (into CLOUD_SOURCES) backing this entry.
 */

export const CLOUD_MODELS = [
  {
    id: 'gpt-56-sol',
    vendor: 'OpenAI',
    name: 'GPT-5.6 Sol',
    tierNote: 'Flagship of the GPT-5.6 family — the "ChatGPT 5+" tier (the `gpt-5.6` alias routes to it).',
    contextTokens: 1_050_000, // OpenAI docs; Artificial Analysis rounds to ~1M
    maxOutputTokens: 128_000,
    pricing: { inputUSD: 5.0, outputUSD: 30.0 },
    pricingNote:
      'Promotional pricing $4 / $20 per M (in/out) available at least through Nov 21, 2026; standard list is $5 / $30. Prompts >272K input tokens bill at 2× input and 1.5× output for the full request.',
    outputTps: 82.8, // Artificial Analysis, OpenAI first-party API (max-effort reasoning variant)
    speedSource: 'C3',
    ttftS: 115.7, // AA "time to first answer token" at MAX effort — includes thinking time
    ttftNote:
      'TTFT is effort-dependent for this reasoning model: ~116 s at max effort (includes thinking); much lower at default/medium effort. Race tab should label the latency offset as "thinking time".',
    intelligenceIndex: { score: 61, rank: '#5 / 187 (proprietary class)' },
    highlights: [
      'Knowledge cutoff Feb 16, 2026; text + image input.',
      'Reasoning.effort supports none → max; default is medium.',
    ],
    sources: ['C1', 'C3'],
  },

  {
    id: 'claude-opus-5',
    vendor: 'Anthropic',
    name: 'Claude Opus 5',
    tierNote: 'Current top of the Claude Opus line (released Jul 24, 2026); "near Fable 5 intelligence at half the price" per Anthropic.',
    contextTokens: 1_000_000, // Default AND maximum on Claude API / Bedrock / GCP / Azure — no beta header needed
    maxOutputTokens: 128_000,
    pricing: { inputUSD: 5.0, outputUSD: 25.0 },
    pricingNote:
      'Same list price as Opus 4.8. Fast mode runs ~2.5× default speed at 2× base price ($10 / $50 per M). Cache discount ≈90% (AA).',
    outputTps: 53, // AA first-party API: 52.9 t/s (max effort); low-effort providers 51.6–53.2 t/s
    speedSource: 'C4',
    ttftS: 2.9, // Midpoint of provider spread 2.53 s (Amazon) – 3.29 s (Anthropic), AA low-effort page
    ttftNote: 'TTFT varies by provider (≈2.5–3.3 s); higher with max reasoning effort.',
    intelligenceIndex: { score: 63, rank: '#1 / 187 (max effort)' },
    highlights: [
      'Lovable: +22% over Opus 4.7 on hardest agentic coding tasks, far less run-to-run variance (Anthropic launch post).',
      'Topped Zapier AutomationBench without spending more tokens than prior Claude models.',
      'CursorBench 3.2 at max effort within 0.5% of Fable 5 peak score at half the cost per task.',
      '1M context is default; performance claimed to hold across the window (addresses Opus 4.8 long-context degradation).',
    ],
    sources: ['C2', 'C4'],
  },

  {
    id: 'deepseek-v4-pro',
    vendor: 'DeepSeek',
    name: 'DeepSeek V4 Pro',
    tierNote: 'Open-weights flagship of the V4 line (model version -0813, released Aug 2026). Thinking mode on by default.',
    contextTokens: 1_000_000,
    maxOutputTokens: 384_000,
    pricing: { inputUSD: 1.32, outputUSD: 3.96 }, // PEAK rates (headline); off-peak is half
    pricingNote:
      'Peak/off-peak structure: peak = Mon–Fri 01:00–04:00 & 06:00–10:00 UTC; off-peak is exactly half ($0.66 / $1.98). Cache-hit input ≈$0.022–0.044 per M (≈97% discount). Launched at $1.74/$3.48; 75% cut made permanent late May 2026.',
    outputTps: 54.1, // AA, DeepSeek first-party API
    speedSource: 'C5',
    ttftS: 1.65, // AA (DeepSeek API) — better than the open-weights median of 2.37 s
    ttftNote: null,
    intelligenceIndex: { score: 53, rank: '#6 / 111 (open-weights class)' },
    highlights: [
      'SWE-bench Verified ≈80.6% — highest open-weights score at time of writing (third-party aggregation; verify before publishing).',
      'Concurrency limit 500 requests (2,500 for V4 Flash).',
      'Supports non-thinking and thinking modes, tool calls, JSON output.',
    ],
    sources: ['C6', 'C5'],
  },

  {
    id: 'deepseek-v4-flash',
    vendor: 'DeepSeek',
    name: 'DeepSeek V4 Flash',
    tierNote: 'Value tier of the V4 line (model version -0731). Good for the cost-panel "cheap cloud" reference.',
    contextTokens: 1_000_000,
    maxOutputTokens: 384_000,
    pricing: { inputUSD: 0.44, outputUSD: 1.32 }, // PEAK rates; off-peak $0.22 / $0.66
    pricingNote: 'Off-peak half-price window same as V4 Pro. Cache-hit input ≈$0.007–0.014 per M (≈50× cheaper than cache miss).',
    outputTps: null, // Not measured in sources gathered for P1 — estimate at build if the race needs it
    speedSource: null,
    ttftS: null,
    ttftNote: null,
    intelligenceIndex: null,
    highlights: ['Concurrency limit 2,500 requests.', 'Vision variant (v4-flash-vision-exp) bills images as input tokens.'],
    sources: ['C6'],
  },
];

/**
 * Consumer subscription alternatives (cost-panel row "subscription instead of per-token").
 */
export const CLOUD_SUBSCRIPTIONS = [
  {
    id: 'chatgpt-plus',
    vendor: 'OpenAI',
    plan: 'ChatGPT Plus',
    priceUSDPerMonth: 20,
    note: 'Consumer tier; "enhanced access" to the ChatGPT web app. Business Standard seat is $20/mo (annual) or $25/mo monthly; Premium seat $100/$125.',
    asOf: '2026-08', // Verified via OpenAI help center + Aug 2026 pricing roundups
    sources: ['C7', 'C8'],
  },
];

/** Flat source list for on-page footnote rendering (P7). */
export const CLOUD_SOURCES = [
  { id: 'C1', label: 'OpenAI — GPT-5.6 Sol model docs (pricing, context window, limits)', url: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol' },
  { id: 'C2', label: 'Anthropic — "Introducing Claude Opus 5" (Jul 24, 2026): pricing, Fast mode, customer agentic-coding results', url: 'https://www.anthropic.com/news/claude-opus-5' },
  { id: 'C3', label: 'Artificial Analysis — GPT-5.6 Sol (max): Intelligence Index 61, 82.8 tok/s, TTFT 115.7 s, $4/$20 promo pricing', url: 'https://artificialanalysis.ai/models/gpt-5-6-sol' },
  { id: 'C4', label: 'Artificial Analysis — Claude Opus 5 (max): Intelligence Index 63 (#1/187), ≈53 tok/s; provider page for TTFT spread', url: 'https://artificialanalysis.ai/models/claude-opus-5' },
  { id: 'C5', label: 'Artificial Analysis — DeepSeek V4 Pro 0813 (max): Intelligence Index 53, 54.1 tok/s, TTFT 1.65 s', url: 'https://artificialanalysis.ai/models/deepseek-v4-pro' },
  { id: 'C6', label: 'DeepSeek API docs — Models & Pricing (official peak/off-peak rates, context length, concurrency limits)', url: 'https://api-docs.deepseek.com/quick_start/pricing/' },
  { id: 'C7', label: 'OpenAI Help Center — "What is ChatGPT Plus?" ($20/month)', url: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus' },
  { id: 'C8', label: 'OpenAI — Business pricing page (Standard/Premium seats, plan list incl. Go/Plus/Business/Enterprise)', url: 'https://openai.com/api/pricing/' },
];
