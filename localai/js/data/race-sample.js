/* ============================================================
   v100 — The Tab 4 race: one real prompt, five real answers
   ------------------------------------------------------------
   CAPTURED 2026-09-05 by the owner. Every answer below is
   verbatim from responses.md in this folder, which is the
   source of truth; this file is its machine-readable form.
   Nothing here is invented.

   WHY THIS FILE EXISTS
   The race used to compare speed alone, using published cloud
   benchmark figures. It now shows QUALITY AS WELL AS SPEED:
   the same prompt, each model's real answer, streamed at the
   speed that model actually produced it. A reader sees both how
   long they waited and what they got for the wait.

   HOW SPEED IS DECIDED — the two kinds differ on purpose:
     - CLOUD answers were timed on the owner's own clock, so
       their rate is fixed: tokens(answer) / writing seconds.
     - LOCAL answers have NO stored rate. The text is from a
       real local run, but the speed is computed by the engine
       for the hardware the reader picked in the Hardware Lab,
       via `modelStopId` into MODEL_STOPS. Change the rig and
       the local racers change with it; the cloud ones do not.

   WHAT WAS NOT MEASURED, stated rather than filled in:
     - GPT-5.6 Luna and DeepSeek V4 Instant were timed end to
       end only. The wait before the first word was not timed
       separately, so `waitS` is 0 and `waitMeasured` is false:
       the whole time is shown as writing. This FLATTERS them
       slightly, since some of those seconds were really wait.
     - Claude Opus 5 was re-timed on a second clock: 16 s total,
       7 s of it thinking before any text appeared.
     - The two free-tier answers may not represent paid tiers,
       which can be faster. `setting` records the tier used.

   Token counts are NOT stored. They are counted at runtime by
   the site's real Qwen3 tokenizer (js/data/vocab.js), so the
   rate a racer moves at is derived from real tokens rather
   than from an assumed words-per-token ratio.
   ============================================================ */

export const RACE_SAMPLE_AS_OF = '2026-09-05';

/** The one prompt given to every model, verbatim. */
export const RACE_PROMPT = "In ~2 paragraphs, explain why someone would run an open-weight AI model locally when frontier models in the cloud are generally more capable.";

/**
 * @typedef {Object} RaceEntry
 * @property {string} id           Stable key.
 * @property {'cloud'|'local'} kind
 * @property {string} vendor       Display name of the provider or model family.
 * @property {string} name         Display name of the model.
 * @property {string} setting      The exact setting used, in the owner's words.
 * @property {string} answer       The model's verbatim response.
 * @property {?number} waitS       Seconds from sending to the first visible word.
 *                                 0 with waitMeasured false = not timed separately.
 * @property {boolean} waitMeasured Whether waitS was actually observed.
 * @property {boolean} waitIsThinking Whether the wait was the model thinking.
 * @property {?number} totalS      Seconds from sending to the last word.
 *                                 Null for local: the engine computes it.
 * @property {?string} modelStopId Local only: MODEL_STOPS label this model sits at,
 *                                 so the engine can compute its speed on the reader's rig.
 * @property {?string} ranOn       For local models: whose machine produced the text.
 * @property {?string} capturedNote Anything that would change how a reader reads it.
 */

export const RACE_ENTRIES = [
  {
    id: "gpt-56-luna",
    kind: "cloud",
    vendor: "OpenAI",
    name: "GPT-5.6 Luna",
    setting: "Free-tier ChatGPT, default settings, no reasoning mode",
    waitS: 0,
    waitMeasured: false,
    waitIsThinking: false,
    totalS: 5.3,
    modelStopId: null,
    ranOn: null,
    capturedOn: '2026-09-05',
    capturedNote: "Wall-clock 5.3 s for the whole answer. The wait before the first word was not timed separately, so the whole time is shown as writing.",
    answer: "Running an open-weight AI model locally is less about beating frontier models on raw capability and more about gaining control. A local model can run without an internet connection, keep prompts and data entirely on your own hardware, avoid API costs and rate limits, and give you predictable access regardless of a provider's pricing, policies, outages, or model changes. You can also fine-tune or modify the model, integrate it deeply into your own software, and run it continuously for specialized tasks without sending every request to a third party. For sensitive information, proprietary files, classroom data, or simply experimentation, that control can be valuable even if the model itself is weaker.\n\nThe tradeoff is essentially sovereignty versus capability. Cloud frontier models give you enormous computational resources and generally superior reasoning, multimodal capabilities, reliability, and access to rapidly improving models—but you surrender some control and depend on an external service. Local models require you to buy and maintain hardware, manage software, accept lower performance or smaller models, and potentially spend more electricity and time getting things working. In practice, a good setup can use both: cloud frontier models for difficult, high-value reasoning and local open-weight models for private, repetitive, offline, cheap, or highly customized workloads.",
  },
  {
    id: "deepseek-v4-instant",
    kind: "cloud",
    vendor: "DeepSeek",
    name: "DeepSeek V4 Instant",
    setting: "Free tier, Deepthink turned off",
    waitS: 0,
    waitMeasured: false,
    waitIsThinking: false,
    totalS: 5.6,
    modelStopId: null,
    ranOn: null,
    capturedOn: '2026-09-05',
    capturedNote: "Wall-clock 5.6 s for the whole answer. The wait before the first word was not timed separately, so the whole time is shown as writing.",
    answer: "The primary driver for running open-weight models locally is **control and sovereignty**. When you use a cloud-based frontier model, every prompt and piece of data traverses a third-party server, often with opaque logging, review policies, and retention schedules. For enterprises handling proprietary source code, financial records, or patient health information, this creates an unacceptable legal and competitive risk. Local deployment guarantees that data never leaves your hardware, ensuring full compliance with regulations like HIPAA, GDPR, and ITAR without needing expensive \"private instance\" contracts. Furthermore, you are immune to API outages, rate limits, and pricing volatility—once you have the hardware, inference cost is a fixed, sunk expense, allowing for unlimited, high-frequency usage without a growing bill.\n\nBeyond privacy, local models offer **deep customization and determinism** that cloud APIs rarely match. You can fine-tune a model on your specific corporate jargon, codebase, or creative style using QLoRA or full parameter updates—a process that is either impossible or exorbitantly expensive with closed APIs. You also have granular control over decoding parameters, can swap out attention mechanisms, or even modify the model's architecture for specialized tasks. This reproducibility is vital for regulated industries that require auditable, deterministic outputs. While frontier models may excel at generalist benchmarks, a smaller, fine-tuned 7B or 70B parameter model running locally can outperform GPT-4 on narrow, high-stakes tasks like legal document classification or domain-specific entity extraction, all while offering lower latency and zero network dependency. For many, the trade-off of raw capability for absolute ownership is not a compromise—it is the requirement.",
  },
  {
    id: "claude-opus-5",
    kind: "cloud",
    vendor: "Anthropic",
    name: "Claude Opus 5",
    setting: "Paid Claude subscription, high effort",
    waitS: 7,
    waitMeasured: true,
    waitIsThinking: true,
    totalS: 16,
    modelStopId: null,
    ranOn: null,
    capturedOn: '2026-09-05',
    capturedNote: "Timed on a second run: 16 s in total, of which the first 7 s were spent thinking before any text appeared.",
    answer: "The honest answer is that capability isn't the only axis that matters, and for a lot of real tasks the frontier margin is wasted. A 4B–30B open-weight model running on a laptop or a small box is enough for classification, extraction, summarization, autocomplete, transcription cleanup, tagging, and the thousand small transformations that make up most actual AI usage — and it does them at zero marginal cost, with no rate limits, no per-token billing, and no request that has to leave the machine. That last part is often the deciding factor: student work, medical notes, legal drafts, internal code, anything covered by a policy or a contract simply can't be posted to a third-party endpoint, and a local model turns \"we can't do this\" into \"we can.\" Reliability is the other quiet one. A cloud model can be deprecated, reprice, change behavior under you between versions, or be unreachable because of an outage, a network boundary, or a flaky link — a weights file on disk gives you the same model, byte-identical, in five years, offline, in a classroom with no internet, or on a plane.\n\nThen there's the class of things you can only do with weights. You can fine-tune on your own data, quantize to fit the hardware you actually have, edit sampling and grammar-constrain output so the model *cannot* emit invalid JSON, inspect activations, batch a million documents overnight without a bill, and embed the thing inside a product you ship to someone else's machine. You can also run it without the refusal behavior and system-prompt scaffolding a hosted model comes with, which is what researchers, red-teamers, and people doing fiction or security work often need — and which is also, fairly, why open weights carry risks hosted models don't. Latency helps too: a local 7B answering in 200ms beats a smarter model 2 seconds away for anything interactive. The mental model that holds up is not \"local versus frontier\" but a tiered one — small local model as the default workhorse, cloud frontier model called deliberately for the hard reasoning, long-context, and agentic jobs where the gap is real and worth paying for.",
  },
  {
    id: "qwen-3-8-27b",
    kind: "local",
    vendor: "Alibaba",
    name: "Qwen3.8-27B",
    setting: "Reasoning off, quick response",
    waitS: null,
    waitMeasured: false,
    waitIsThinking: false,
    totalS: null,
    modelStopId: "27B",
    ranOn: "the owner's machine",
    capturedOn: '2026-09-05',
    capturedNote: "The answer is from a real local run on the owner’s machine. The speed you see is NOT that run: it is computed by this site’s engine for the hardware you picked in the Hardware Lab.",
    answer: "The primary motivation for running open-weight models locally is often rooted in data privacy and security concerns that cloud-based solutions inherently struggle to address. By keeping inference on-premises, organizations can ensure that sensitive proprietary data, personal information, or confidential business strategies never leave their controlled environment, thereby mitigating the risks associated with third-party data retention policies, potential breaches, or regulatory compliance issues like GDPR and HIPAA. This self-sovereignty is particularly critical for industries such as healthcare, finance, and legal services, where the cost of a data leak far outweighs the performance gap between local and frontier models. Additionally, local deployment eliminates dependency on external internet connectivity and vendor availability, ensuring that AI capabilities remain accessible even during network outages or service disruptions.\n\nBeyond privacy, there are significant economic and operational advantages to local inference for high-volume use cases. While cloud APIs charge per token, which can become prohibitively expensive at scale, running open-weight models allows users to amortize the initial hardware investment over unlimited usage, leading to substantial long-term cost savings. Furthermore, local deployment offers greater flexibility in customization; developers can fine-tune open-weight models on specific datasets or modify their architecture without waiting for vendor updates or adhering to strict API limitations. This level of control enables tailored solutions that are deeply integrated into existing workflows, providing a balance between acceptable performance and the autonomy required for specialized applications where absolute top-tier capability is less critical than reliability, speed, and data integrity.",
  },
  {
    id: "gemma-4-e4b",
    kind: "local",
    vendor: "Google",
    name: "Gemma 4 E4B",
    setting: "Reasoning off, quick response",
    waitS: null,
    waitMeasured: false,
    waitIsThinking: false,
    totalS: null,
    modelStopId: "8B",
    ranOn: "the owner's machine",
    capturedOn: '2026-09-05',
    capturedNote: "The answer is from a real local run on the owner’s machine. The speed you see is NOT that run: it is computed by this site’s engine for the hardware you picked in the Hardware Lab.",
    answer: "The primary motivations for running an open-weight AI model locally, despite the superior capabilities of large frontier models hosted in the cloud, revolve around control, privacy, and operational independence. When sensitive data must be processed without ever leaving a secured environment—a critical requirement in regulated industries like healthcare or defense—local execution guarantees end-to-end data sovereignty, mitigating the risks associated with external API calls. Furthermore, running an open-weight model allows users to inspect, modify, and fine-tune the weights themselves, moving beyond simple API interaction. This level of granular control enables users to deeply specialize the model for highly unique, domain-specific tasks that a general-purpose cloud model might handle insufficiently or slowly.\n\nBeyond security and customization, the decision to run locally is often driven by economic scalability and operational resilience. While cloud frontier models charge per token or usage, running an optimized local model incurs only hardware and electricity costs after the initial setup. This allows for virtually limitless, high-throughput inference without worrying about fluctuating API pricing or restrictive rate limits. Most importantly, a local installation ensures absolute uptime and accessibility. If the internet goes down or the cloud provider experiences an outage, a locally hosted model remains operational, providing mission-critical functionality that transcends reliance on external infrastructure.",
  },
];
/** Pure: display emphasis. The stored answer is verbatim, markdown and all;
 *  this strips the inline emphasis markers so the page shows words rather
 *  than asterisks. Nothing else about the text is altered. */
export function displayText(answer) {
  return String(answer ?? '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(?!\s)([^*\n]+?)\*/g, '$1');
}

/** True once there is enough here to run the race from real data. */
export function raceSampleReady(entries = RACE_ENTRIES) {
  return (entries ?? []).length > 0
    && entries.every((e) => e.answer && (e.kind === 'local' ? e.modelStopId : e.totalS != null));
}

/** Pure: tokens per second for a CLOUD entry, from its measured time.
 *  `tokenCount` is the real token count of the answer, counted by the
 *  tokenizer rather than estimated. Local entries return null: their
 *  speed comes from the engine, not from this file. */
export function entryTps(entry, tokenCount) {
  if (!entry || entry.kind === 'local') return null;
  if (entry.totalS == null || !tokenCount) return null;
  const writingS = entry.totalS - (entry.waitS ?? 0);
  return writingS > 0 ? tokenCount / writingS : null;
}
