/* ============================================================
   v100 — The Tab 4 race: one real prompt, five real answers
   ------------------------------------------------------------
   TEMPLATE, 2026-09-05. Owner to fill in. Nothing here is
   invented, and nothing should be: every field below is either
   text the owner captured or a figure the owner measured.

   WHY THIS FILE EXISTS
   The race used to compare speed alone, using published cloud
   benchmark figures. The owner's decision (2026-09-05) is that
   the race should show QUALITY AS WELL AS SPEED: the same
   prompt, each model's real answer, streamed at the speed that
   model actually produced it. A reader then sees both how long
   they waited and what they got for the wait.

   THE LINEUP (owner's, 2026-09-05). Every model is set for a
   quick response, with reasoning turned off or left at its
   normal chat default, because that is what an ordinary person
   meets. This deliberately replaces the old max-reasoning-effort
   figures, which made a fast model look slow.

   FILLING THIS IN
   Run the same prompt through each model, then paste in:
     - the answer, verbatim, including any formatting
     - how long you waited before the first word appeared
     - how long the whole answer took, OR the tokens per second
       the tool reported
   If you only have wall-clock timings, give `waitS` and
   `totalS` and leave `tps` null: the race can derive the rate.

   HONESTY RULES for this file, same as everywhere else here:
     - No estimated numbers. If you did not measure it, null.
     - `capturedOn` and `capturedNote` say when and how, because
       these are one-off observations on one machine and one
       network, not benchmarks.
     - Local answers are tied to the machine that produced them.
       State it, so nobody reads them as a claim about all
       hardware.
   ============================================================ */

export const RACE_SAMPLE_AS_OF = null; // e.g. '2026-09-06' once captured

/** The one prompt given to every model, verbatim. */
export const RACE_PROMPT = '';

/**
 * @typedef {Object} RaceEntry
 * @property {string} id           Stable key. Cloud ids should match cloud.js where a model exists there.
 * @property {'cloud'|'local'} kind
 * @property {string} vendor       Display name of the provider or model family.
 * @property {string} name         Display name of the model.
 * @property {string} setting      The exact setting used, in the owner's words.
 *                                 e.g. 'free tier, no reasoning', 'Deepthink off'.
 * @property {string} answer       The model's verbatim response. '' until captured.
 * @property {?number} waitS       Seconds from sending to the first visible word.
 * @property {?number} totalS      Seconds from sending to the last word. Null if unknown.
 * @property {?number} tps         Measured tokens per second, if the tool reported one.
 *                                 Leave null and the race derives it from totalS.
 * @property {?string} ranOn       For local models: the machine it ran on. Null for cloud.
 * @property {?string} capturedOn  ISO date the run was captured.
 * @property {?string} capturedNote Anything that would change how a reader reads it.
 */

export const RACE_ENTRIES = [
  {
    id: 'gpt-56-luna',
    kind: 'cloud',
    vendor: 'OpenAI',
    name: 'GPT-5.6 Luna',
    setting: 'Free tier ChatGPT, default settings',
    answer: '',
    waitS: null,
    totalS: null,
    tps: null,
    ranOn: null,
    capturedOn: null,
    capturedNote: null,
  },
  {
    id: 'deepseek-instant',
    kind: 'cloud',
    vendor: 'DeepSeek',
    name: 'DeepSeek Instant',
    setting: 'Deepthink turned off',
    answer: '',
    waitS: null,
    totalS: null,
    tps: null,
    ranOn: null,
    capturedOn: null,
    capturedNote: null,
  },
  {
    id: 'claude-opus-5-chat',
    kind: 'cloud',
    vendor: 'Anthropic',
    name: 'Claude Opus 5',
    setting: 'Standard chat, high effort',
    answer: '',
    waitS: null,
    totalS: null,
    tps: null,
    ranOn: null,
    capturedOn: null,
    capturedNote: null,
  },
  {
    id: 'gemma-4-12b-qat',
    kind: 'local',
    vendor: 'Google',
    name: 'Gemma 4 12B QAT',
    setting: 'Reasoning off, quick response',
    answer: '',
    waitS: null,
    totalS: null,
    tps: null,
    ranOn: null, // e.g. 'RTX 3090 24 GB, 64 GB DDR5-6000'
    capturedOn: null,
    capturedNote: null,
  },
  {
    id: 'qwen-3-8-27b',
    kind: 'local',
    vendor: 'Alibaba',
    name: 'Qwen 3.8 27B',
    setting: 'Reasoning off, quick response',
    answer: '',
    waitS: null,
    totalS: null,
    tps: null,
    ranOn: null,
    capturedOn: null,
    capturedNote: null,
  },
];

/** True once there is enough here to run the race from real data. */
export function raceSampleReady(entries = RACE_ENTRIES) {
  return (entries ?? []).length > 0
    && entries.every((e) => e.answer && e.waitS != null && (e.tps != null || e.totalS != null));
}

/** Pure: tokens per second for an entry, measured or derived from the total.
 *  `tokenCount` is the real token count of the answer, counted by the
 *  tokenizer rather than estimated. Returns null when it cannot be known. */
export function entryTps(entry, tokenCount) {
  if (!entry) return null;
  if (entry.tps != null) return entry.tps;
  if (entry.totalS == null || entry.waitS == null || !tokenCount) return null;
  const writingS = entry.totalS - entry.waitS;
  return writingS > 0 ? tokenCount / writingS : null;
}
